import "server-only";

import type { QueryDslQueryContainer, SearchRequest } from "@elastic/elasticsearch/lib/api/types";

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
  PersonPagePayload,
  PersonStats,
  SearchResult,
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

interface QueryLogEntry {
  op: string;
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
  if (process.env.NODE_ENV !== "production") {
    const tag = entry.error ? "ERR" : "OK";
    console.log(
      `[search:${tag}] ${entry.op} took=${entry.took_ms}ms es=${entry.es_took_ms ?? "?"}ms hits=${entry.hits_total ?? "?"}`,
    );
  }
  if (process.env.QUERY_LOG_WRITE !== "1") return;
  void esClient()
    .index({ index: QUERY_LOG_INDEX, document: entry })
    .catch(() => {
      // silently swallow; logging is best-effort
    });
}

async function timed<T>(
  op: string,
  args: Record<string, unknown>,
  fn: () => Promise<{ result: T; esTookMs: number | null; hitsTotal: number | null }>,
): Promise<T> {
  const start = performance.now();
  let esTookMs: number | null = null;
  let hitsTotal: number | null = null;
  let error: string | null = null;
  try {
    const out = await fn();
    esTookMs = out.esTookMs;
    hitsTotal = out.hitsTotal;
    return out.result;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    logQuery({
      op,
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
      _source: { excludes: ["enrichments.embedding", "text"] },
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

async function searchSpeechesBm25(
  p: SearchSpeechesParams,
  page: number,
  pageSize: number,
): Promise<SearchResult<MoSpeech>> {
  const filters = speechFilters(p);
  const must: QueryDslQueryContainer[] = [];
  if (p.q && p.q.trim()) {
    must.push({
      multi_match: {
        query: p.q,
        fields: ["text^2", "agenda_title^1.5", "speaker.name_search"],
        type: "best_fields",
        operator: "or",
      },
    });
  } else {
    must.push({ match_all: {} });
  }
  const res = await esClient().search<MoSpeech>({
    index: ES_INDEX.speeches,
    from: offsetFor(page, pageSize),
    size: pageSize,
    // Without this, ES early-terminates total counting and returns different
    // approximate totals per page — which gives the user inconsistent
    // "Pagina X din Y" values as they paginate. Forcing exact counts costs a
    // few ms but is the right trade for pagination correctness.
    track_total_hits: true,
    query: { bool: { must, filter: filters } },
    highlight: p.q
      ? {
          fields: {
            text: { number_of_fragments: 1, fragment_size: 220 },
            agenda_title: { number_of_fragments: 0 },
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
    page: page,
    pageSize,
    tookMs: res.took ?? 0,
    highlights: p.q ? highlights : undefined,
  };
}

export async function searchSpeeches(
  params: SearchSpeechesParams,
): Promise<SearchResult<MoSpeech>> {
  const page = params.page ?? 1;
  const pageSize = clampPageSize(params.pageSize);
  return timed("searchSpeeches", { ...params, pageSize, page }, async () => {
    // RRF mode is wired in a later phase (it needs the embed service).
    // For v0 we always serve BM25; the rankFusion flag is accepted but a no-op
    // when set to 'rrf' (silent degradation per docs/architecture.md).
    const result = await searchSpeechesBm25(params, page, pageSize);
    return { result, esTookMs: result.tookMs, hitsTotal: result.total };
  });
}

// kNN-only ablation. Requires the embed service (EMBED_URL); when unavailable
// throws so callers can surface a clear error rather than silently degrading.
export async function searchSpeechesKnn(
  _params: SearchSpeechesParams,
): Promise<SearchResult<MoSpeech>> {
  return timed("searchSpeechesKnn", {}, async () => {
    throw new Error("searchSpeechesKnn: embedding service integration ships in a later phase");
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

export async function personPage(slug: string): Promise<PersonPagePayload | null> {
  return timed("personPage", { slug }, async () => {
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
    const speechRes = await esClient().search<MoSpeech>({
      index: ES_INDEX.speeches,
      size: 10,
      query: {
        bool: {
          filter: [
            { term: { "speaker.person_id": person.id } },
            { term: { is_substantive: true } },
          ],
        },
      },
      sort: [{ session_date: { order: "desc" } }],
      aggs: {
        speech_count: { value_count: { field: "record_id" } },
        first_speech_date: { min: { field: "session_date" } },
        last_speech_date: { max: { field: "session_date" } },
      },
      _source: { excludes: ["enrichments.embedding", "text"] },
    });
    const aggs = speechRes.aggregations as
      | {
          speech_count: { value: number };
          first_speech_date: { value_as_string?: string; value: number | null };
          last_speech_date: { value_as_string?: string; value: number | null };
        }
      | undefined;
    const stats: PersonStats = person.stats ?? {
      speech_count: aggs?.speech_count.value ?? 0,
      first_speech_date: aggs?.first_speech_date.value_as_string ?? null,
      last_speech_date: aggs?.last_speech_date.value_as_string ?? null,
      interpellation_count: 0,
      question_count: 0,
    };
    return {
      result: {
        person,
        recentSpeeches: speechRes.hits.hits.flatMap((h) => (h._source ? [h._source] : [])),
        stats,
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
