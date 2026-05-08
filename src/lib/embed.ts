import "server-only";

import { env } from "@/env";

// BGE-M3 vectors are L2-normalised by the indexer service (see monitorul-ii's
// embedder/main.py — `normalize: true` is the default both there and here).
// ES `enrichments.embedding` is mapped with `similarity: cosine`, which on
// normalised vectors is equivalent to dot product. Asking for raw vectors
// would silently mismatch the index distance metric, so we never override.
// 10 s matches the Python `monitorul_ii.elasticsearch.queries._embed_query_text`
// timeout. The first call after a cold container is the slow one (BGE-M3
// weights load on demand); steady-state is sub-100 ms.
const EMBED_TIMEOUT_MS = 10_000;

export interface EmbedResponse {
  vectors: number[][];
  model_id: string;
  dims: number;
}

// Process-local LRU on `(provider, model/url, trimmed_text) → vector`. The
// embed-service round-trip is the dominant non-ES cost on `searchSpeeches`
// (~1 s in production). BGE-M3 is deterministic — same input → same vector —
// so the cache is invariant under repeat queries by design. Capacity 500
// entries × ~32 KB per 1024-dim vector ≈ 16 MB resident; tune via the
// constant below if the working set grows past it.
//
// Model-bump safety: the cache key includes the live provider's model
// identifier. For cloud, that's `EMBED_CLOUD_MODEL`; for local, the
// `EMBED_URL` (env-level changes spawn a fresh process with an empty cache).
// A model swap behind the same URL during a single process lifetime would
// poison the cache — accepted as exotic; serverless/container restarts on
// every deploy bound the worst-case staleness window.
//
// Failures are NOT cached: a transient embed-service outage returns null
// once and is retried on the next call rather than being remembered.
const QUERY_VECTOR_CACHE_CAPACITY = 500;
const queryVectorCache = new Map<string, number[]>();

function cacheKey(text: string): string {
  if (env.EMBED_PROVIDER === "cloud") {
    return `cloud:${env.EMBED_CLOUD_MODEL ?? ""}:${text}`;
  }
  return `local:${env.EMBED_URL ?? ""}:${text}`;
}

function cacheLookup(text: string): number[] | undefined {
  const key = cacheKey(text);
  const v = queryVectorCache.get(key);
  if (!v) return undefined;
  // LRU bump: delete + reinsert moves the entry to the most-recently-used end
  // of `Map`'s insertion order, so the next eviction targets the actual LRU.
  queryVectorCache.delete(key);
  queryVectorCache.set(key, v);
  return v;
}

function cacheStore(text: string, vector: number[]): void {
  const key = cacheKey(text);
  if (queryVectorCache.has(key)) {
    queryVectorCache.delete(key);
  } else if (queryVectorCache.size >= QUERY_VECTOR_CACHE_CAPACITY) {
    const oldest = queryVectorCache.keys().next().value;
    if (oldest !== undefined) queryVectorCache.delete(oldest);
  }
  queryVectorCache.set(key, vector);
}

/**
 * Vectorise a single text via the configured embed provider (`EMBED_PROVIDER`).
 * Returns `null` on any failure (missing creds for the active provider, network
 * error, timeout, non-200, malformed body). The caller is expected to silently
 * degrade to BM25-only — see Q8 of the design doc on hybrid contract: "If the
 * embed service is unreachable, RRF mode silently degrades to BM25-only."
 *
 * Repeat calls with the same text hit a process-local LRU and skip the
 * service round-trip entirely.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const cached = cacheLookup(trimmed);
  if (cached) return cached;
  const vector =
    env.EMBED_PROVIDER === "cloud" ? await embedViaCloud(trimmed) : await embedViaLocal(trimmed);
  if (vector) cacheStore(trimmed, vector);
  return vector;
}

// Local FastAPI service shipped with monitorul-ii (POST /embed).
async function embedViaLocal(text: string): Promise<number[] | null> {
  if (!env.EMBED_URL) return null;
  const url = `${env.EMBED_URL.replace(/\/$/, "")}/embed`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [text], normalize: true }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<EmbedResponse>;
    const vec = data.vectors?.[0];
    if (!vec || vec.length === 0) return null;
    return vec;
  } catch {
    return null;
  }
}

// Hosted OpenAI-compatible /v1/embeddings (e.g. cloud BGE-M3 endpoints). If
// EMBED_CLOUD_URL already includes the /embeddings path it's used as-is;
// otherwise /v1/embeddings is appended. Vectors come back L2-normalised
// (BGE-M3 default), so we pass through unchanged.
async function embedViaCloud(text: string): Promise<number[] | null> {
  if (!env.EMBED_CLOUD_URL || !env.EMBED_CLOUD_TOKEN) return null;
  const base = env.EMBED_CLOUD_URL.replace(/\/$/, "");
  const url = base.endsWith("/embeddings") ? base : `${base}/v1/embeddings`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.EMBED_CLOUD_TOKEN}`,
      },
      body: JSON.stringify({ model: env.EMBED_CLOUD_MODEL, input: [text] }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const vec = data.data?.[0]?.embedding;
    if (!vec || vec.length === 0) return null;
    return vec;
  } catch {
    return null;
  }
}
