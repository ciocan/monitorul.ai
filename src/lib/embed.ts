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

/**
 * Vectorise a single text via the local BGE-M3 service. Returns `null` on any
 * failure (missing EMBED_URL, network error, timeout, non-200 response). The
 * caller is expected to silently degrade to BM25-only — see Q8 of the design
 * doc on hybrid contract: "If the embed service is unreachable, RRF mode
 * silently degrades to BM25-only."
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!env.EMBED_URL) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const url = `${env.EMBED_URL.replace(/\/$/, "")}/embed`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [trimmed], normalize: true }),
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
