import "server-only";

import type { QueryDslQueryContainer, SearchRequest } from "@elastic/elasticsearch/lib/api/types";

import { env } from "@/env";

import { embedQuery } from "./embed";
import { ES_INDEX, QUERY_LOG_INDEX, esClient } from "./es-client";
import type {
  Chamber,
  Grain,
  MoAgendaItem,
  MoCommitteeMeeting,
  MoDocument,
  MoInterpellation,
  MoPerson,
  MoQuestion,
  MoReport,
  MoSpeech,
  MoVote,
  PersonActivityDay,
  PersonActivityWindow,
  PersonPagePayload,
  PersonStats,
  PersonYearCount,
  SearchResult,
  SessionYearCount,
  SessionsIndexPayload,
} from "./types";

// Hard server-side guardrails. The layer is the only path from app → ES; these
// caps and defaults are intentionally not configurable from caller arguments.
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
const MAX_AGG_BUCKETS = 100;

type ChildGrainHit =
  | ({ grain: "agenda-items" } & MoAgendaItem)
  | ({ grain: "speeches" } & MoSpeech)
  | ({ grain: "votes" } & MoVote)
  | ({ grain: "interpellations" } & MoInterpellation)
  | ({ grain: "questions" } & MoQuestion);

type ServedMode = "rrf" | "bm25-only";

interface QueryLogEntry {
  op: string;
  // User-facing search string, surfaced as a top-level field (also retained
  // inside `args`) so analytics can aggregate on it without parsing nested
  // objects. Trimmed; null for non-search ops (getDocument, personPage, etc.)
  // and for empty/whitespace queries.
  q: string | null;
  // 1-indexed page number, lifted from `args.page` for paged ops; null for
  // ops that don't paginate (getters, listDocumentChildren, personPage, …).
  page: number | null;
  // Retrieval mode actually served (not what the caller asked for). RRF can
  // silently degrade to bm25-only on empty q / unreachable embedder / deep
  // pages / zero-BM25 hits; logging the served mode shows the degrade rate.
  // Null for ops that don't have a hybrid path.
  mode: ServedMode | null;
  took_ms: number;
  es_took_ms: number | null;
  hits_total: number | null;
  error: string | null;
  args: Record<string, unknown>;
  timestamp: string;
}

function clampPageSize(n: number | undefined): number {
  if (!n || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

function offsetFor(page: number | undefined, pageSize: number): number {
  const p = page && page > 0 ? page : 1;
  return (p - 1) * pageSize;
}

function totalOf(hitsTotal: unknown): number {
  if (typeof hitsTotal === "number") return hitsTotal;
  if (
    hitsTotal &&
    typeof hitsTotal === "object" &&
    "value" in hitsTotal &&
    typeof (hitsTotal as { value: unknown }).value === "number"
  ) {
    return (hitsTotal as { value: number }).value;
  }
  return 0;
}

// Fire-and-forget query log. The reader API key won't have write permission on
// monitorul_query_log; failures are swallowed by design (the indexer pipeline
// runs the actual logger). In dev, we still emit to stderr for visibility.
function logQuery(entry: QueryLogEntry): void {
  if (env.NODE_ENV !== "production") {
    const tag = entry.error ? "ERR" : "OK";
    console.log(
      `[search:${tag}] ${entry.op} took=${entry.took_ms}ms es=${entry.es_took_ms ?? "?"}ms hits=${entry.hits_total ?? "?"}`,
    );
  }
  if (!env.QUERY_LOG_WRITE) return;
  void esClient()
    .index({ index: QUERY_LOG_INDEX, document: entry })
    .catch(() => {
      // silently swallow; logging is best-effort
    });
}

async function timed<T>(
  op: string,
  args: Record<string, unknown>,
  fn: () => Promise<{
    result: T;
    esTookMs: number | null;
    hitsTotal: number | null;
    mode?: ServedMode;
  }>,
): Promise<T> {
  const start = performance.now();
  let esTookMs: number | null = null;
  let hitsTotal: number | null = null;
  let mode: ServedMode | null = null;
  let error: string | null = null;
  try {
    const out = await fn();
    esTookMs = out.esTookMs;
    hitsTotal = out.hitsTotal;
    mode = out.mode ?? null;
    return out.result;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    const rawQ = typeof args.q === "string" ? args.q.trim() : "";
    const argsPage = typeof args.page === "number" ? args.page : null;
    logQuery({
      op,
      q: rawQ.length > 0 ? rawQ : null,
      page: argsPage,
      mode,
      took_ms: Math.round(performance.now() - start),
      es_took_ms: esTookMs,
      hits_total: hitsTotal,
      error,
      args,
      timestamp: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Single-record getters

export async function getDocument(id: string): Promise<MoDocument | null> {
  return timed("getDocument", { id }, async () => {
    try {
      const res = await esClient().get<MoDocument>({
        index: ES_INDEX.documents,
        id,
      });
      return { result: res._source ?? null, esTookMs: null, hitsTotal: 1 };
    } catch (e) {
      if (
        (e as { statusCode?: number; meta?: { statusCode?: number } })?.meta?.statusCode === 404
      ) {
        return { result: null, esTookMs: null, hitsTotal: 0 };
      }
      throw e;
    }
  });
}

export async function getAgendaItem(id: string): Promise<MoAgendaItem | null> {
  return timed("getAgendaItem", { id }, async () => {
    try {
      const res = await esClient().get<MoAgendaItem>({
        index: ES_INDEX.agendaItems,
        id,
      });
      return { result: res._source ?? null, esTookMs: null, hitsTotal: 1 };
    } catch (e) {
      if ((e as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) {
        return { result: null, esTookMs: null, hitsTotal: 0 };
      }
      throw e;
    }
  });
}

export async function getSpeech(id: string): Promise<MoSpeech | null> {
  return timed("getSpeech", { id }, async () => {
    try {
      const res = await esClient().get<MoSpeech>({
        index: ES_INDEX.speeches,
        id,
      });
      return { result: res._source ?? null, esTookMs: null, hitsTotal: 1 };
    } catch (e) {
      if ((e as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) {
        return { result: null, esTookMs: null, hitsTotal: 0 };
      }
      throw e;
    }
  });
}

export async function getReport(id: string): Promise<MoReport | null> {
  return timed("getReport", { id }, async () => {
    try {
      const res = await esClient().get<MoReport>({
        index: ES_INDEX.reports,
        id,
      });
      return { result: res._source ?? null, esTookMs: null, hitsTotal: 1 };
    } catch (e) {
      if ((e as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) {
        return { result: null, esTookMs: null, hitsTotal: 0 };
      }
      throw e;
    }
  });
}

// ---------------------------------------------------------------------------
// Document playback: list every child record across grains in source order.

export async function listDocumentChildren(documentId: string): Promise<{
  agenda: MoAgendaItem[];
  children: ChildGrainHit[];
}> {
  return timed("listDocumentChildren", { documentId }, async () => {
    const filter = { term: { document_id: documentId } };
    const req: SearchRequest = {
      index: [
        ES_INDEX.agendaItems,
        ES_INDEX.speeches,
        ES_INDEX.votes,
        ES_INDEX.interpellations,
        ES_INDEX.questions,
      ].join(","),
      size: 500,
      query: { bool: { filter: [filter] } },
      sort: [{ position_in_document: { order: "asc", missing: "_last" } }],
      // `text` is intentionally kept — the document playback page renders speech
      // bodies inline. Embedding vectors stay out (1024 floats × N speeches).
      _source: { excludes: ["enrichments.embedding"] },
    };
    const res = await esClient().search<unknown>(req);
    const agenda: MoAgendaItem[] = [];
    const children: ChildGrainHit[] = [];
    for (const h of res.hits.hits) {
      const idx = h._index ?? "";
      const src = h._source as Record<string, unknown> | undefined;
      if (!src) continue;
      if (idx.startsWith("mo-agenda-items")) {
        const item = src as unknown as MoAgendaItem;
        agenda.push(item);
        children.push({ grain: "agenda-items", ...item });
      } else if (idx.startsWith("mo-speeches")) {
        children.push({ grain: "speeches", ...(src as unknown as MoSpeech) });
      } else if (idx.startsWith("mo-votes")) {
        children.push({ grain: "votes", ...(src as unknown as MoVote) });
      } else if (idx.startsWith("mo-interpellations")) {
        children.push({
          grain: "interpellations",
          ...(src as unknown as MoInterpellation),
        });
      } else if (idx.startsWith("mo-questions")) {
        children.push({ grain: "questions", ...(src as unknown as MoQuestion) });
      }
    }
    agenda.sort((a, b) => a.ordinal - b.ordinal);
    return {
      result: { agenda, children },
      esTookMs: res.took ?? null,
      hitsTotal: totalOf(res.hits.total),
    };
  });
}

// ---------------------------------------------------------------------------
// Listings

export async function listDocumentsByDate(date: string, chamber?: Chamber): Promise<MoDocument[]> {
  return timed("listDocumentsByDate", { date, chamber }, async () => {
    const filters: QueryDslQueryContainer[] = [{ term: { session_date: date } }];
    if (chamber) filters.push({ term: { chamber } });
    const res = await esClient().search<MoDocument>({
      index: ES_INDEX.documents,
      size: MAX_PAGE_SIZE,
      query: { bool: { filter: filters } },
      sort: [{ published: { order: "asc" } }],
    });
    return {
      result: res.hits.hits.flatMap((h) => (h._source ? [h._source] : [])),
      esTookMs: res.took ?? null,
      hitsTotal: totalOf(res.hits.total),
    };
  });
}

export async function listCommitteeMeetings(
  committeeId: string,
  dateFrom?: string,
): Promise<MoCommitteeMeeting[]> {
  return timed("listCommitteeMeetings", { committeeId, dateFrom }, async () => {
    const filters: QueryDslQueryContainer[] = [{ term: { committee_id: committeeId } }];
    if (dateFrom) {
      filters.push({ range: { meeting_date: { gte: dateFrom } } });
    }
    const res = await esClient().search<MoCommitteeMeeting>({
      index: ES_INDEX.committeeMeetings,
      size: MAX_PAGE_SIZE,
      query: { bool: { filter: filters } },
      sort: [{ meeting_date: { order: "desc" } }],
    });
    return {
      result: res.hits.hits.flatMap((h) => (h._source ? [h._source] : [])),
      esTookMs: res.took ?? null,
      hitsTotal: totalOf(res.hits.total),
    };
  });
}

// ---------------------------------------------------------------------------
// Sessions index (`/mo`): per-year totals plus the document list for one year.
// Largest year in the archive (~280 docs) fits comfortably under 500, so the
// list query reads the whole year in a single hit rather than paginating.

// Years in the archive run 2000–present. The legacy parse failure at year=0
// is filtered out everywhere so it can't surface as an empty "Anul 0" column.
const SESSION_YEAR_MIN = 1990;
const SESSION_YEAR_MAX = 2100;
const SESSION_LIST_SIZE = 500;

async function fetchSessionYearCounts(): Promise<SessionYearCount[]> {
  const res = await esClient().search({
    index: ES_INDEX.documents,
    size: 0,
    aggs: {
      by_year: {
        terms: {
          field: "year",
          size: 100,
          order: { _key: "asc" },
          min_doc_count: 1,
        },
      },
    },
  });
  const buckets =
    (
      res.aggregations as
        | { by_year: { buckets: Array<{ key: number; doc_count: number }> } }
        | undefined
    )?.by_year.buckets ?? [];
  return buckets
    .map((b) => ({ year: b.key, count: b.doc_count }))
    .filter((b) => b.year >= SESSION_YEAR_MIN && b.year <= SESSION_YEAR_MAX);
}

async function fetchSessionsForYear(year: number): Promise<MoDocument[]> {
  const res = await esClient().search<MoDocument>({
    index: ES_INDEX.documents,
    size: SESSION_LIST_SIZE,
    track_total_hits: true,
    query: { bool: { filter: [{ term: { year } }] } },
    // session_date is the editorial sort key (when the sitting happened).
    // published is the tie-breaker for the rare cases where multiple issues
    // share a date; issue is the final fallback for documents missing dates
    // entirely (older archive years occasionally do).
    sort: [
      { session_date: { order: "desc", missing: "_last" } },
      { published: { order: "desc", missing: "_last" } },
      { issue: { order: "desc" } },
    ],
  });
  return res.hits.hits.flatMap((h) => (h._source ? [h._source] : []));
}

export async function sessionsIndex(opts: { year?: number } = {}): Promise<SessionsIndexPayload> {
  return timed("sessionsIndex", opts, async () => {
    const requestedYear =
      opts.year && opts.year >= SESSION_YEAR_MIN && opts.year <= SESSION_YEAR_MAX
        ? opts.year
        : null;
    // When a year is provided we can fan out — counts for the sparkbar and
    // sessions for the list don't depend on each other. Without a year we
    // fetch counts first to derive the default selection.
    let yearlyCounts: SessionYearCount[];
    let sessions: MoDocument[];
    if (requestedYear !== null) {
      const [counts, list] = await Promise.all([
        fetchSessionYearCounts(),
        fetchSessionsForYear(requestedYear),
      ]);
      yearlyCounts = counts;
      sessions = list;
    } else {
      yearlyCounts = await fetchSessionYearCounts();
      const fallbackYear = yearlyCounts.at(-1)?.year ?? null;
      sessions = fallbackYear ? await fetchSessionsForYear(fallbackYear) : [];
    }
    const selectedYear = requestedYear ?? yearlyCounts.at(-1)?.year ?? null;
    const archiveSessionTotal = yearlyCounts.reduce((sum, c) => sum + c.count, 0);
    return {
      result: { yearlyCounts, sessions, selectedYear, archiveSessionTotal },
      esTookMs: null,
      hitsTotal: sessions.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Speeches search: BM25 default, optional client-side RRF fusion with kNN.

export interface SearchSpeechesParams {
  q?: string;
  speakerPersonId?: string;
  chamber?: Chamber;
  dateFrom?: string;
  dateTo?: string;
  refBills?: string[];
  topics?: string[];
  isSubstantive?: boolean;
  page?: number;
  pageSize?: number;
  rankFusion?: "rrf" | "bm25-only";
}

function speechFilters(p: SearchSpeechesParams): QueryDslQueryContainer[] {
  const filters: QueryDslQueryContainer[] = [];
  const isSubstantive = p.isSubstantive ?? true; // public default
  filters.push({ term: { is_substantive: isSubstantive } });
  if (p.speakerPersonId) filters.push({ term: { "speaker.person_id": p.speakerPersonId } });
  if (p.chamber) filters.push({ term: { chamber: p.chamber } });
  if (p.dateFrom || p.dateTo) {
    filters.push({
      range: {
        session_date: {
          ...(p.dateFrom ? { gte: p.dateFrom } : {}),
          ...(p.dateTo ? { lte: p.dateTo } : {}),
        },
      },
    });
  }
  if (p.refBills && p.refBills.length > 0) {
    filters.push({ terms: { "refs.bills": p.refBills } });
  }
  if (p.topics && p.topics.length > 0) {
    filters.push({ terms: { "enrichments.topics": p.topics } });
  }
  return filters;
}

// RRF tuning — kept in sync with Python `monitorul_ii.elasticsearch.queries`
// constants where possible. `RRF_RANK_CONSTANT=60` is the de-facto standard
// since the 2009 paper. `RRF_NUM_CANDIDATES_MULT=10` matches the Python value
// (HNSW exploration depth per shard). Pool/window sizes diverge from Python:
// Python scales the window linearly with page (`page * page_size`), this layer
// caps at 200 and falls back to BM25-only past that — a cost ceiling chosen
// for public-traffic latency over deep-page hybrid quality.
const RRF_RANK_CONSTANT = 60;
const RRF_NUM_CANDIDATES_MULT = 10;
const RRF_NUM_CANDIDATES_FLOOR = 100;
const RRF_POOL_FLOOR = 100;
const RRF_POOL_CAP = 200;

// Speech multi_match field set. Mirrors the Python sibling's
// `SPEECH_SEARCH_FIELDS` in `monitorul_ii.elasticsearch.queries`. Each
// diacritic-bearing main field is paired with a `.folded` subfield
// (analyzed with `romanian_folded` = lowercase + asciifolding) at a
// lower boost so a query like `sosoaca` matches indexed `șoșoacă` via
// the folded path while diacritic-correct queries still rank exact
// matches first via the higher main-field boost. The folded subfields
// are populated by the indexer-side mapping change shipped alongside
// this constant; the multi_match silently no-ops on indices that
// haven't been re-indexed yet (ES treats missing fields as "no
// match"), so this is forward-compatible across both upgrades.
const SPEECH_SEARCH_FIELDS: string[] = [
  "text^2",
  "text.folded^1",
  "agenda_title^1.5",
  "agenda_title.folded^0.75",
  "speaker.name_search",
  "speaker.name_search.folded",
];

interface Bm25LegResult {
  hits: MoSpeech[];
  total: number;
  tookMs: number;
  highlights: Record<string, string>;
}

async function bm25Leg(
  p: SearchSpeechesParams,
  filters: QueryDslQueryContainer[],
  from: number,
  size: number,
): Promise<Bm25LegResult> {
  const must: QueryDslQueryContainer[] = [];
  if (p.q && p.q.trim()) {
    must.push({
      multi_match: {
        query: p.q,
        fields: SPEECH_SEARCH_FIELDS,
        type: "best_fields",
        operator: "or",
      },
    });
  } else {
    must.push({ match_all: {} });
  }
  const res = await esClient().search<MoSpeech>({
    index: ES_INDEX.speeches,
    from,
    size,
    // Without this, ES early-terminates total counting and returns different
    // approximate totals per page — which gives the user inconsistent
    // "Pagina X din Y" values as they paginate. Forcing exact counts costs a
    // few ms but is the right trade for pagination correctness.
    track_total_hits: true,
    query: { bool: { must, filter: filters } },
    highlight: p.q
      ? {
          // Highlight on both the diacritic-bearing main field and the
          // `.folded` subfield so no-diacritic queries (`sosoaca`) still
          // get snippet markup — the match landed on `text.folded`, the
          // highlighter must look there too. ES merges fragments across
          // matched_fields onto the parent field's render path.
          fields: {
            text: {
              number_of_fragments: 1,
              fragment_size: 220,
              matched_fields: ["text", "text.folded"],
              type: "unified",
            },
            agenda_title: {
              number_of_fragments: 0,
              matched_fields: ["agenda_title", "agenda_title.folded"],
              type: "unified",
            },
          },
          pre_tags: ["<mark>"],
          post_tags: ["</mark>"],
        }
      : undefined,
    _source: { excludes: ["enrichments.embedding"] },
    sort: p.q ? undefined : [{ session_date: { order: "desc" } }],
  });
  const highlights: Record<string, string> = {};
  for (const h of res.hits.hits) {
    const id = h._source?.record_id;
    const snippet = h.highlight?.text?.[0] ?? h.highlight?.agenda_title?.[0];
    if (id && snippet) highlights[id] = snippet;
  }
  return {
    hits: res.hits.hits.flatMap((h) => (h._source ? [h._source] : [])),
    total: totalOf(res.hits.total),
    tookMs: res.took ?? 0,
    highlights,
  };
}

interface KnnLegResult {
  hits: MoSpeech[];
  tookMs: number;
}

async function knnLeg(
  vector: number[],
  filters: QueryDslQueryContainer[],
  k: number,
): Promise<KnnLegResult> {
  const res = await esClient().search<MoSpeech>({
    index: ES_INDEX.speeches,
    size: k,
    knn: {
      field: "enrichments.embedding",
      query_vector: vector,
      k,
      // Per-shard HNSW exploration depth. `10×` mirrors the Python sibling's
      // `RRF_NUM_CANDIDATES_MULT` and is the recall/latency knob: more
      // candidates = better neighbour discovery, slightly higher CPU.
      num_candidates: Math.max(RRF_NUM_CANDIDATES_FLOOR, k * RRF_NUM_CANDIDATES_MULT),
      filter: filters,
    },
    _source: { excludes: ["enrichments.embedding"] },
  });
  return {
    hits: res.hits.hits.flatMap((h) => (h._source ? [h._source] : [])),
    tookMs: res.took ?? 0,
  };
}

// Reciprocal Rank Fusion. score(d) = Σ over legs of 1 / (rank_constant + rank_in_leg).
// Docs that appear in both legs accumulate higher than those that appear in one.
// Insertion order in the input legs IS the rank (1-indexed).
//
// Tiebreaker: `record_id` ascending. Mirrors the Python sibling's
// `sorted(rrf_scores.keys(), key=lambda d: (-rrf_scores[d], d))` so identical
// queries produce identical orderings across both code paths — important for
// cache-key stability and reproducibility of any analytics that join on
// (query, position) pairs.
function fuseRrf(legs: MoSpeech[][], rankConstant: number = RRF_RANK_CONSTANT): MoSpeech[] {
  const scored = new Map<string, { doc: MoSpeech; score: number }>();
  for (const leg of legs) {
    leg.forEach((doc, i) => {
      const rank = i + 1;
      const score = 1 / (rankConstant + rank);
      const existing = scored.get(doc.record_id);
      if (existing) {
        existing.score += score;
      } else {
        scored.set(doc.record_id, { doc, score });
      }
    });
  }
  return Array.from(scored.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.doc.record_id < b.doc.record_id ? -1 : a.doc.record_id > b.doc.record_id ? 1 : 0;
    })
    .map((e) => e.doc);
}

async function searchSpeechesBm25(
  p: SearchSpeechesParams,
  page: number,
  pageSize: number,
): Promise<SearchResult<MoSpeech>> {
  const filters = speechFilters(p);
  const leg = await bm25Leg(p, filters, offsetFor(page, pageSize), pageSize);
  return {
    hits: leg.hits,
    total: leg.total,
    page,
    pageSize,
    tookMs: leg.tookMs,
    highlights: p.q ? leg.highlights : undefined,
    mode: "bm25-only",
  };
}

async function searchSpeechesRrf(
  p: SearchSpeechesParams,
  page: number,
  pageSize: number,
): Promise<SearchResult<MoSpeech>> {
  const offset = offsetFor(page, pageSize);
  const poolSize = Math.min(Math.max(pageSize * 5, RRF_POOL_FLOOR), RRF_POOL_CAP);

  // Deep pagination: the fused pool can't span past `poolSize`. Fall back to
  // BM25-only (it paginates natively via `from`/`size`) so users can keep
  // clicking forward without empty pages.
  if (offset >= poolSize) {
    return searchSpeechesBm25(p, page, pageSize);
  }

  // Vectorise the query. If the embed service is unreachable, silently
  // degrade to BM25-only — Q8 contract: never serve a stale or absent vector.
  const q = p.q?.trim();
  if (!q) return searchSpeechesBm25(p, page, pageSize);
  const vector = await embedQuery(q);
  if (!vector) return searchSpeechesBm25(p, page, pageSize);

  const filters = speechFilters(p);
  const [bm25, knn] = await Promise.all([
    bm25Leg(p, filters, 0, poolSize),
    knnLeg(vector, filters, poolSize),
  ]);

  // BM25 is the relevance gate. BGE-M3 produces a vector for any input
  // (including gibberish), so kNN always returns its top-k — even for
  // nonsense queries it surfaces 100 weakly-related "neighbours" at
  // similarity scores ~0.74 (vs ~0.79 for real semantic matches). To avoid
  // hallucinating results, kNN is only fused into the final list when BM25
  // has found at least one lexical anchor. Typos with at least one BM25
  // hit (e.g. "educatie" matching the archaic "educațiunii") still benefit
  // from kNN's expansion.
  const knnHitsForFusion = bm25.hits.length > 0 ? knn.hits : [];
  const fused = fuseRrf([bm25.hits, knnHitsForFusion]);
  const pageHits = fused.slice(offset, offset + pageSize);

  // Highlights only exist for hits that BM25 saw. kNN-only hits render
  // without a snippet — that's fine; the agenda title still gives context.
  const highlights: Record<string, string> = {};
  for (const hit of pageHits) {
    const snippet = bm25.highlights[hit.record_id];
    if (snippet) highlights[hit.record_id] = snippet;
  }

  // Total: take max of BM25's lexical total and the fused-pool size. This
  // matters when BM25 finds few hits (e.g. typo / no-diacritic query) but
  // kNN adds dozens of semantic neighbors — the user sees ~poolSize results
  // on screen and "1 rezultat" in the header would be a lie. Past poolSize
  // we trust BM25's total because that's what the deep-paging fallback can
  // actually serve.
  const total = Math.max(bm25.total, fused.length);

  return {
    hits: pageHits,
    total,
    page,
    pageSize,
    // Legs ran in parallel; report the slower one as the wall-clock cost.
    tookMs: Math.max(bm25.tookMs, knn.tookMs),
    highlights: Object.keys(highlights).length > 0 ? highlights : undefined,
    mode: "rrf",
  };
}

export async function searchSpeeches(
  params: SearchSpeechesParams,
): Promise<SearchResult<MoSpeech>> {
  const page = params.page ?? 1;
  const pageSize = clampPageSize(params.pageSize);
  return timed("searchSpeeches", { ...params, pageSize, page }, async () => {
    const useRrf = (params.rankFusion ?? "rrf") === "rrf" && Boolean(params.q?.trim());
    const result = useRrf
      ? await searchSpeechesRrf(params, page, pageSize)
      : await searchSpeechesBm25(params, page, pageSize);
    return {
      result,
      esTookMs: result.tookMs,
      hitsTotal: result.total,
      mode: result.mode,
    };
  });
}

// kNN-only ablation: useful for debugging the embedding leg in isolation.
// Throws on failure (no silent BM25 fallback) so callers can distinguish
// "embedding service down" from "no semantic matches".
export async function searchSpeechesKnn(
  params: SearchSpeechesParams,
): Promise<SearchResult<MoSpeech>> {
  const page = params.page ?? 1;
  const pageSize = clampPageSize(params.pageSize);
  return timed("searchSpeechesKnn", { ...params, pageSize, page }, async () => {
    const q = params.q?.trim();
    if (!q) throw new Error("searchSpeechesKnn: q is required");
    const vector = await embedQuery(q);
    if (!vector) throw new Error("searchSpeechesKnn: embed service unavailable (set EMBED_URL)");
    const filters = speechFilters(params);
    const offset = offsetFor(page, pageSize);
    const total = pageSize * 5; // kNN doesn't have a natural "total" — cap at top 5 pages
    const leg = await knnLeg(vector, filters, total);
    const result: SearchResult<MoSpeech> = {
      hits: leg.hits.slice(offset, offset + pageSize),
      total: leg.hits.length,
      page,
      pageSize,
      tookMs: leg.tookMs,
      mode: "rrf", // a kNN-only run is conceptually a "vector" mode; we tag it `rrf` for now since the SearchResult enum is binary.
    };
    return { result, esTookMs: result.tookMs, hitsTotal: result.total, mode: result.mode };
  });
}

// ---------------------------------------------------------------------------
// Persons

export async function searchPersons(q: string, pageSize?: number): Promise<MoPerson[]> {
  const size = clampPageSize(pageSize);
  return timed("searchPersons", { q, size }, async () => {
    if (!q.trim()) {
      return { result: [], esTookMs: null, hitsTotal: 0 };
    }
    const res = await esClient().search<MoPerson>({
      index: ES_INDEX.persons,
      size,
      query: {
        multi_match: {
          query: q,
          fields: ["canonical_name^2", "canonical_name.folded", "aliases"],
          operator: "and",
          type: "best_fields",
        },
      },
    });
    return {
      result: res.hits.hits.flatMap((h) => (h._source ? [h._source] : [])),
      esTookMs: res.took ?? null,
      hitsTotal: totalOf(res.hits.total),
    };
  });
}

// The heatmap renders one calendar year (Jan 1 – Dec 31). Anchoring to
// calendar years rather than rolling 365-day windows lets the year-sparkbar
// columns line up with the heatmap cleanly: clicking 2018 always shows the
// 2018 grid, regardless of which day in 2018 the politician last spoke.
function computeActivityWindow(year: number | null): PersonActivityWindow | null {
  if (!year || !Number.isInteger(year)) return null;
  const padded = String(year).padStart(4, "0");
  return { from: `${padded}-01-01`, to: `${padded}-12-31` };
}

function yearOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

async function fetchPersonActivity(
  personId: string,
  window: PersonActivityWindow,
): Promise<PersonActivityDay[]> {
  const res = await esClient().search({
    index: ES_INDEX.speeches,
    size: 0,
    query: {
      bool: {
        filter: [
          { term: { "speaker.person_id": personId } },
          { term: { is_substantive: true } },
          { range: { session_date: { gte: window.from, lte: window.to } } },
        ],
      },
    },
    aggs: {
      by_day: {
        date_histogram: {
          field: "session_date",
          calendar_interval: "day",
          format: "yyyy-MM-dd",
          // Sparse buckets only — cheaper than emitting 365 zero-count buckets;
          // the renderer fills the empty days from the (from, to) range itself.
          min_doc_count: 1,
        },
      },
    },
  });
  const buckets =
    (
      res.aggregations as
        | {
            by_day: { buckets: Array<{ key_as_string: string; doc_count: number }> };
          }
        | undefined
    )?.by_day.buckets ?? [];
  return buckets.map((b) => ({ date: b.key_as_string, count: b.doc_count }));
}

// A single sitting rarely produces more than ~30 substantive speeches by one
// speaker, so 50 covers the long tail of a day filter without paginating.
const PERSON_DAY_SPEECH_LIMIT = 50;
const PERSON_RECENT_SPEECH_LIMIT = 10;

export interface PersonPageOptions {
  year?: number;
  // `YYYY-MM-DD`. When set, the speeches list narrows to that single day and
  // the heatmap marks that cell. Year is derived from the day string.
  day?: string;
}

export async function personPage(
  slug: string,
  opts: PersonPageOptions = {},
): Promise<PersonPagePayload | null> {
  return timed("personPage", { slug, year: opts.year, day: opts.day }, async () => {
    const personRes = await esClient()
      .get<MoPerson>({ index: ES_INDEX.persons, id: slug })
      .catch((e) => {
        if ((e as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) return null;
        throw e;
      });
    if (!personRes || !personRes._source) {
      return { result: null, esTookMs: null, hitsTotal: 0 };
    }
    const person = personRes._source;
    const day = opts.day ?? null;
    // Day implies year — the heatmap and sparkbar should track the day's
    // calendar year regardless of any explicit `?year=` (which is redundant
    // but tolerated for share-link robustness).
    const yearFromDay = day ? Number.parseInt(day.slice(0, 4), 10) : null;
    const requestedYear = yearFromDay ?? opts.year ?? null;
    const personSpeechFilters: QueryDslQueryContainer[] = [
      { term: { "speaker.person_id": person.id } },
      { term: { is_substantive: true } },
    ];
    if (day) {
      personSpeechFilters.push({ term: { session_date: day } });
    } else if (requestedYear) {
      personSpeechFilters.push({
        range: {
          session_date: { gte: `${requestedYear}-01-01`, lte: `${requestedYear}-12-31` },
        },
      });
    }
    // Two queries in parallel:
    // 1. Filtered speech search — drives the speeches list, narrowed to the
    //    selected year/day.
    // 2. Unfiltered career-long aggregations — drives the sparkbar and the
    //    stats fallback. These need every year, not just the filtered scope,
    //    so they live in their own request rather than a `global` agg (which
    //    we tried first; the sub-`filter` re-applies the parent year filter
    //    despite the spec, so the per-year buckets came back filtered).
    const [speechRes, careerRes] = await Promise.all([
      esClient().search<MoSpeech>({
        index: ES_INDEX.speeches,
        size: day ? PERSON_DAY_SPEECH_LIMIT : PERSON_RECENT_SPEECH_LIMIT,
        track_total_hits: true,
        query: { bool: { filter: personSpeechFilters } },
        sort: [{ session_date: { order: "desc" } }, { position_in_document: { order: "asc" } }],
        // `text` is intentionally retained — the speeches list shows an
        // excerpt (truncated client-side to ~240 chars). Embedding vectors
        // stay out (1024 floats × 50 hits would be ~200 KB of ballast).
        _source: { excludes: ["enrichments.embedding"] },
      }),
      esClient().search({
        index: ES_INDEX.speeches,
        size: 0,
        query: {
          bool: {
            filter: [
              { term: { "speaker.person_id": person.id } },
              { term: { is_substantive: true } },
            ],
          },
        },
        aggs: {
          speech_count: { value_count: { field: "record_id" } },
          first_speech_date: { min: { field: "session_date" } },
          last_speech_date: { max: { field: "session_date" } },
          by_year: {
            date_histogram: {
              field: "session_date",
              calendar_interval: "year",
              format: "yyyy",
              min_doc_count: 1,
            },
          },
        },
      }),
    ]);
    const careerAggs = careerRes.aggregations as
      | {
          speech_count: { value: number };
          first_speech_date: { value_as_string?: string; value: number | null };
          last_speech_date: { value_as_string?: string; value: number | null };
          by_year: { buckets: Array<{ key_as_string: string; doc_count: number }> };
        }
      | undefined;
    const stats: PersonStats = person.stats ?? {
      speech_count: careerAggs?.speech_count.value ?? 0,
      first_speech_date: careerAggs?.first_speech_date.value_as_string ?? null,
      last_speech_date: careerAggs?.last_speech_date.value_as_string ?? null,
      interpellation_count: 0,
      question_count: 0,
    };
    const yearlyCounts: PersonYearCount[] = (careerAggs?.by_year.buckets ?? [])
      .map((b) => ({ year: Number.parseInt(b.key_as_string, 10), count: b.doc_count }))
      .filter((b) => Number.isInteger(b.year))
      .sort((a, b) => a.year - b.year);
    // Default selection: most recent active year. An out-of-range explicit
    // `?year=` (e.g. before the politician's first session) still renders —
    // the heatmap shows an empty grid so the user understands their selection
    // landed somewhere with no activity.
    const fallbackYear = yearlyCounts.at(-1)?.year ?? yearOf(stats.last_speech_date);
    const selectedYear = requestedYear ?? fallbackYear ?? null;
    const window = computeActivityWindow(selectedYear);
    const activity = window ? await fetchPersonActivity(person.id, window) : [];
    return {
      result: {
        person,
        recentSpeeches: speechRes.hits.hits.flatMap((h) => (h._source ? [h._source] : [])),
        stats,
        activity,
        activityWindow: window,
        yearlyCounts,
        selectedYear,
        selectedDate: day,
        filteredSpeechTotal: totalOf(speechRes.hits.total),
      },
      esTookMs: speechRes.took ?? null,
      hitsTotal: totalOf(speechRes.hits.total),
    };
  });
}

// ---------------------------------------------------------------------------
// Aggregations

export async function aggSpeechesByPartyYear(params: {
  year?: number;
  chamber?: Chamber;
}): Promise<Array<{ party: string; year: number; count: number }>> {
  return timed("aggSpeechesByPartyYear", params, async () => {
    const filters: QueryDslQueryContainer[] = [{ term: { is_substantive: true } }];
    if (params.year) filters.push({ term: { year: params.year } });
    if (params.chamber) filters.push({ term: { chamber: params.chamber } });
    const res = await esClient().search({
      index: ES_INDEX.speeches,
      size: 0,
      query: { bool: { filter: filters } },
      aggs: {
        by_party: {
          terms: {
            field: "speaker.party_group_at_time",
            size: MAX_AGG_BUCKETS,
          },
          aggs: {
            by_year: {
              terms: { field: "year", size: MAX_AGG_BUCKETS, order: { _key: "asc" } },
            },
          },
        },
      },
    });
    const buckets =
      (
        res.aggregations as
          | {
              by_party: {
                buckets: Array<{
                  key: string;
                  doc_count: number;
                  by_year: { buckets: Array<{ key: number; doc_count: number }> };
                }>;
              };
            }
          | undefined
      )?.by_party.buckets ?? [];
    const out: Array<{ party: string; year: number; count: number }> = [];
    for (const p of buckets) {
      for (const y of p.by_year.buckets) {
        out.push({ party: p.key, year: y.key, count: y.doc_count });
      }
    }
    return { result: out, esTookMs: res.took ?? null, hitsTotal: out.length };
  });
}

// ---------------------------------------------------------------------------
// Archive-wide counts (homepage register). Each grain is counted in parallel
// via Promise.allSettled so a partial outage on one index doesn't blank the
// section — successful counts still render, missing ones simply omit.

export type ArchiveStatKey =
  | "documents"
  | "agendaItems"
  | "speeches"
  | "substantiveSpeeches"
  | "votes"
  | "interpellations"
  | "questions"
  | "committeeMeetings"
  | "reports"
  | "persons";

export type ArchiveStats = Partial<Record<ArchiveStatKey, number>>;

export async function getArchiveStats(): Promise<ArchiveStats> {
  return timed("getArchiveStats", {}, async () => {
    const c = esClient();
    const queries: Array<[ArchiveStatKey, () => Promise<{ count: number }>]> = [
      ["documents", () => c.count({ index: ES_INDEX.documents })],
      ["agendaItems", () => c.count({ index: ES_INDEX.agendaItems })],
      ["speeches", () => c.count({ index: ES_INDEX.speeches })],
      [
        "substantiveSpeeches",
        () =>
          c.count({
            index: ES_INDEX.speeches,
            query: { term: { is_substantive: true } },
          }),
      ],
      ["votes", () => c.count({ index: ES_INDEX.votes })],
      ["interpellations", () => c.count({ index: ES_INDEX.interpellations })],
      ["questions", () => c.count({ index: ES_INDEX.questions })],
      ["committeeMeetings", () => c.count({ index: ES_INDEX.committeeMeetings })],
      ["reports", () => c.count({ index: ES_INDEX.reports })],
      ["persons", () => c.count({ index: ES_INDEX.persons })],
    ];
    const settled = await Promise.allSettled(queries.map(([, fn]) => fn()));
    const stats: ArchiveStats = {};
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        stats[queries[i][0]] = r.value.count;
      }
    });
    return {
      result: stats,
      esTookMs: null,
      hitsTotal: Object.keys(stats).length,
    };
  });
}

// ---------------------------------------------------------------------------
// Re-exports for callers that only need the grain enum / payload type.

export type { Grain, MoDocument, MoAgendaItem, MoSpeech, MoVote, MoPerson, ChildGrainHit };
