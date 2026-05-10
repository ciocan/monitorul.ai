import "server-only";

import type { QueryDslQueryContainer, SearchRequest } from "@elastic/elasticsearch/lib/api/types";
import { after } from "next/server";

import { env } from "@/env";

import { embedQuery } from "./embed";
import { ES_INDEX, QUERY_LOG_INDEX, esClient } from "./es-client";
import { type RequestSurface, requestContext } from "./request-context";
import type {
  Chamber,
  CommitteePagePayload,
  CommitteeRankRow,
  CommitteeYearCount,
  CommitteesIndexPayload,
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
  PoliticianRankRow,
  PoliticianYearCount,
  PoliticiansIndexPayload,
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
  | ({ grain: "questions" } & MoQuestion)
  | ({ grain: "committee-meetings" } & MoCommitteeMeeting);

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
  // Which entry point fired this call. Set via `requestContext` by the route
  // handler that owns the surface (the MCP route stamps `"mcp"`, the
  // autocomplete route stamps `"api"`, RSC pages stamp `"web"`). Defaults to
  // `"web"` when no context is set so older log rows remain comparable
  // shape-wise. Lets analytics split traffic per surface without joining.
  surface: RequestSurface;
  // For `surface === "mcp"`, the LLM-facing tool name (`search_speeches`,
  // `describe_corpus`, …). The `op` field carries the lib function name; this
  // carries the public tool name. Null for non-MCP surfaces.
  tool: string | null;
  // For `surface === "mcp"`, the Better Auth user ID — every MCP call
  // carries one because the route is auth-gated. Null on `web` / `api`
  // surfaces (anonymous web traffic, the per-user signing of the autocomplete
  // route doesn't propagate here yet).
  user_id: string | null;
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

// Best-effort query log. Scheduled via Next's `after()` so the index POST
// runs after the response has been sent — without it, fire-and-forget on
// Fluid Compute / serverless gets dropped when the function suspends, which
// is why short-lived MCP tool calls were silently losing rows while RSC pages
// (which keep the function busy long enough for `void` to flush) showed up.
// `after()` is tracked by the platform's `waitUntil`, so the runtime keeps
// the invocation alive until the write settles. Failures are still swallowed.
function logQuery(entry: QueryLogEntry): void {
  if (env.NODE_ENV !== "production") {
    const tag = entry.error ? "ERR" : "OK";
    const surfaceTag = entry.surface === "web" ? "" : ` ${entry.surface}`;
    const toolTag = entry.tool ? `[${entry.tool}]` : "";
    console.log(
      `[search:${tag}${surfaceTag}]${toolTag} ${entry.op} took=${entry.took_ms}ms es=${entry.es_took_ms ?? "?"}ms hits=${entry.hits_total ?? "?"}`,
    );
  }
  if (!env.QUERY_LOG_WRITE) return;
  after(async () => {
    try {
      await esClient().index({ index: QUERY_LOG_INDEX, document: entry });
    } catch {
      // best-effort
    }
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
    const ctx = requestContext.getStore();
    logQuery({
      op,
      q: rawQ.length > 0 ? rawQ : null,
      page: argsPage,
      mode,
      // Surface defaults to `web` so RSC pages and any other unannotated
      // caller end up in the right bucket for analytics. The MCP and API
      // route handlers stamp the context explicitly.
      surface: ctx?.surface ?? "web",
      tool: ctx?.tool ?? null,
      user_id: ctx?.userId ?? null,
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
        // Committee meetings are per-doc children too — `committee_synthesis`
        // documents are typically *only* meetings, with no agenda/speeches at
        // all. Including them here lets the document page render meetings
        // inline rather than show an empty playback section.
        ES_INDEX.committeeMeetings,
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
      } else if (idx.startsWith("mo-committee-meetings")) {
        children.push({
          grain: "committee-meetings",
          ...(src as unknown as MoCommitteeMeeting),
        });
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
// Politicians index (`/politicieni`): top-N by substantive-speech count for
// the selected year, alongside per-year totals for the sparkbar. Stats live
// outside `mo-persons` (the persons index has an empty `stats` field today;
// rankings are derived live from `mo-speeches` aggregations) so this layer
// owns the cross-index join.

const POLITICIAN_RANK_LIMIT = 100;

function politicianRankFilters(opts: {
  year: number | null;
  substantiveOnly: boolean;
}): QueryDslQueryContainer[] {
  const filters: QueryDslQueryContainer[] = [{ exists: { field: "speaker.person_id" } }];
  if (opts.substantiveOnly) filters.push({ term: { is_substantive: true } });
  if (opts.year !== null) filters.push({ term: { year: opts.year } });
  return filters;
}

async function fetchPoliticianYearCounts(substantiveOnly: boolean): Promise<PoliticianYearCount[]> {
  const filters = politicianRankFilters({ year: null, substantiveOnly });
  const res = await esClient().search({
    index: ES_INDEX.speeches,
    size: 0,
    query: { bool: { filter: filters } },
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

interface RankBucketRaw {
  personId: string;
  speechCount: number;
  firstSpeechDate: string | null;
  lastSpeechDate: string | null;
  fallbackName: string;
}

interface RankAggResult {
  buckets: RankBucketRaw[];
  distinctPersons: number;
  totalSpeeches: number;
}

async function fetchTopPoliticianBuckets(opts: {
  year: number | null;
  substantiveOnly: boolean;
}): Promise<RankAggResult> {
  const filters = politicianRankFilters(opts);
  const res = await esClient().search({
    index: ES_INDEX.speeches,
    size: 0,
    track_total_hits: true,
    query: { bool: { filter: filters } },
    aggs: {
      by_person: {
        terms: {
          field: "speaker.person_id",
          size: POLITICIAN_RANK_LIMIT,
          order: { _count: "desc" },
        },
        aggs: {
          first_date: { min: { field: "session_date" } },
          last_date: { max: { field: "session_date" } },
          // Most-recent speech for each speaker carries the freshest spelling
          // of their name. Used as the row label when the persons-index lookup
          // misses (transitional indexing window).
          name_sample: {
            top_hits: {
              size: 1,
              sort: [{ session_date: { order: "desc" } }],
              _source: ["speaker.name_raw"],
            },
          },
        },
      },
      distinct_persons: { cardinality: { field: "speaker.person_id" } },
    },
  });
  const aggs = res.aggregations as
    | {
        by_person: {
          buckets: Array<{
            key: string;
            doc_count: number;
            first_date: { value_as_string?: string };
            last_date: { value_as_string?: string };
            name_sample: {
              hits: {
                hits: Array<{ _source?: { speaker?: { name_raw?: string } } }>;
              };
            };
          }>;
        };
        distinct_persons: { value: number };
      }
    | undefined;
  const buckets = (aggs?.by_person.buckets ?? []).map((b) => {
    const sampleName = b.name_sample.hits.hits[0]?._source?.speaker?.name_raw ?? b.key;
    return {
      personId: b.key,
      speechCount: b.doc_count,
      firstSpeechDate: b.first_date.value_as_string ?? null,
      lastSpeechDate: b.last_date.value_as_string ?? null,
      fallbackName: sampleName,
    };
  });
  return {
    buckets,
    distinctPersons: aggs?.distinct_persons.value ?? 0,
    totalSpeeches: totalOf(res.hits.total),
  };
}

async function fetchPersonsByIds(ids: string[]): Promise<Map<string, MoPerson>> {
  if (ids.length === 0) return new Map();
  const res = await esClient().mget<MoPerson>({ index: ES_INDEX.persons, ids });
  const map = new Map<string, MoPerson>();
  for (const doc of res.docs ?? []) {
    if ("found" in doc && doc.found && doc._source) {
      // mget returns _id as `string | number` in the type but it's always a
      // string for our keyword-id index — coerce to satisfy strict mode.
      map.set(String(doc._id), doc._source);
    }
  }
  return map;
}

export async function politiciansIndex(
  opts: { year?: number; substantiveOnly?: boolean } = {},
): Promise<PoliticiansIndexPayload> {
  return timed("politiciansIndex", opts, async () => {
    const requestedYear =
      opts.year && opts.year >= SESSION_YEAR_MIN && opts.year <= SESSION_YEAR_MAX
        ? opts.year
        : null;
    // `substantiveOnly` defaults true to match the public default applied
    // everywhere else in this layer (see the `is_substantive` filter on
    // searchSpeeches). Setting it false widens the universe to include
    // procedural turn-taking — useful for surfacing session presidents who
    // accumulate huge raw counts but rarely deliver substantive speeches.
    const substantiveOnly = opts.substantiveOnly ?? true;
    // Year counts come first (the unfiltered axis); then we know the fallback
    // year to query for the ranking when none was supplied.
    const yearlyCounts = await fetchPoliticianYearCounts(substantiveOnly);
    const fallbackYear = yearlyCounts.at(-1)?.year ?? null;
    const selectedYear = requestedYear ?? fallbackYear;
    const [rank, totalRegistryPersons] = await Promise.all([
      fetchTopPoliticianBuckets({ year: selectedYear, substantiveOnly }),
      esClient()
        .count({ index: ES_INDEX.persons })
        .then((r) => r.count),
    ]);
    const personMap = await fetchPersonsByIds(rank.buckets.map((b) => b.personId));
    const topPersons: PoliticianRankRow[] = rank.buckets.map((b) => ({
      person: personMap.get(b.personId) ?? null,
      personId: b.personId,
      fallbackName: b.fallbackName,
      speechCount: b.speechCount,
      firstSpeechDate: b.firstSpeechDate,
      lastSpeechDate: b.lastSpeechDate,
    }));
    return {
      result: {
        yearlyCounts,
        topPersons,
        selectedYear,
        substantiveOnly,
        totalRegistryPersons,
        linkedPersonsInScope: rank.distinctPersons,
        speechesInScope: rank.totalSpeeches,
      },
      esTookMs: null,
      hitsTotal: topPersons.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Committees index (`/comisii`): top-N by meeting count for the selected
// year, alongside per-year totals for the sparkbar. There is no upstream
// `mo-committees` index — the registry is derived live from
// `mo-committee-meetings`, so a committee with zero meetings is invisible
// to the registry. Acceptable: this site indexes the public record.

const COMMITTEE_RANK_LIMIT = 100;

interface CommitteeMeetingNameSample {
  committee_name?: string;
  committee_kind?: string | null;
  joint_with?: string[] | null;
}

interface CommitteeBucketRaw {
  committeeId: string;
  meetingCount: number;
  firstMeetingDate: string | null;
  lastMeetingDate: string | null;
  // Latest-meeting spelling of the committee's display fields. Used as the
  // canonical naming source since there's no `mo-committees` index.
  name: string;
  kind: string | null;
  jointWith: string[] | null;
}

interface CommitteeRankAggResult {
  buckets: CommitteeBucketRaw[];
  distinctCommittees: number;
  totalMeetings: number;
}

function committeeRankFilters(opts: { year: number | null }): QueryDslQueryContainer[] {
  const filters: QueryDslQueryContainer[] = [{ exists: { field: "committee_id" } }];
  if (opts.year !== null) {
    filters.push({
      range: {
        meeting_date: {
          gte: `${opts.year}-01-01`,
          lte: `${opts.year}-12-31`,
        },
      },
    });
  }
  return filters;
}

async function fetchCommitteeYearCounts(): Promise<CommitteeYearCount[]> {
  const res = await esClient().search({
    index: ES_INDEX.committeeMeetings,
    size: 0,
    query: { bool: { filter: [{ exists: { field: "meeting_date" } }] } },
    aggs: {
      by_year: {
        date_histogram: {
          field: "meeting_date",
          calendar_interval: "year",
          min_doc_count: 1,
          format: "yyyy",
        },
      },
    },
  });
  const buckets =
    (
      res.aggregations as
        | { by_year: { buckets: Array<{ key_as_string?: string; doc_count: number }> } }
        | undefined
    )?.by_year.buckets ?? [];
  return buckets.flatMap((b) => {
    const year = b.key_as_string ? Number.parseInt(b.key_as_string, 10) : Number.NaN;
    if (!Number.isInteger(year)) return [];
    if (year < SESSION_YEAR_MIN || year > SESSION_YEAR_MAX) return [];
    return [{ year, count: b.doc_count }];
  });
}

async function fetchTopCommitteeBuckets(opts: {
  year: number | null;
}): Promise<CommitteeRankAggResult> {
  const filters = committeeRankFilters(opts);
  const res = await esClient().search({
    index: ES_INDEX.committeeMeetings,
    size: 0,
    track_total_hits: true,
    query: { bool: { filter: filters } },
    aggs: {
      by_committee: {
        terms: {
          field: "committee_id",
          size: COMMITTEE_RANK_LIMIT,
          order: { _count: "desc" },
        },
        aggs: {
          first_date: { min: { field: "meeting_date" } },
          last_date: { max: { field: "meeting_date" } },
          // Most-recent meeting for each committee carries the freshest
          // spelling of its display fields — same idiom as the politician
          // rank `name_sample`.
          name_sample: {
            top_hits: {
              size: 1,
              sort: [{ meeting_date: { order: "desc" } }],
              _source: ["committee_name", "committee_kind", "joint_with"],
            },
          },
        },
      },
      distinct_committees: { cardinality: { field: "committee_id" } },
    },
  });
  const aggs = res.aggregations as
    | {
        by_committee: {
          buckets: Array<{
            key: string;
            doc_count: number;
            first_date: { value_as_string?: string };
            last_date: { value_as_string?: string };
            name_sample: {
              hits: {
                hits: Array<{ _source?: CommitteeMeetingNameSample }>;
              };
            };
          }>;
        };
        distinct_committees: { value: number };
      }
    | undefined;
  const buckets = (aggs?.by_committee.buckets ?? []).map((b): CommitteeBucketRaw => {
    const sample = b.name_sample.hits.hits[0]?._source;
    return {
      committeeId: b.key,
      meetingCount: b.doc_count,
      firstMeetingDate: b.first_date.value_as_string ?? null,
      lastMeetingDate: b.last_date.value_as_string ?? null,
      name: sample?.committee_name ?? b.key,
      kind: sample?.committee_kind ?? null,
      jointWith: sample?.joint_with && sample.joint_with.length > 0 ? sample.joint_with : null,
    };
  });
  return {
    buckets,
    distinctCommittees: aggs?.distinct_committees.value ?? 0,
    totalMeetings: totalOf(res.hits.total),
  };
}

async function fetchTotalCommitteeCount(): Promise<number> {
  const res = await esClient().search({
    index: ES_INDEX.committeeMeetings,
    size: 0,
    track_total_hits: false,
    aggs: { distinct_committees: { cardinality: { field: "committee_id" } } },
  });
  return (
    (res.aggregations as { distinct_committees: { value: number } } | undefined)
      ?.distinct_committees.value ?? 0
  );
}

export async function committeesIndex(
  opts: { year?: number } = {},
): Promise<CommitteesIndexPayload> {
  return timed("committeesIndex", opts, async () => {
    const requestedYear =
      opts.year && opts.year >= SESSION_YEAR_MIN && opts.year <= SESSION_YEAR_MAX
        ? opts.year
        : null;
    const yearlyCounts = await fetchCommitteeYearCounts();
    const fallbackYear = yearlyCounts.at(-1)?.year ?? null;
    const selectedYear = requestedYear ?? fallbackYear;
    const [rank, totalCommittees] = await Promise.all([
      fetchTopCommitteeBuckets({ year: selectedYear }),
      fetchTotalCommitteeCount(),
    ]);
    const topCommittees: CommitteeRankRow[] = rank.buckets.map((b) => ({
      committeeId: b.committeeId,
      name: b.name,
      kind: b.kind,
      jointWith: b.jointWith,
      meetingCount: b.meetingCount,
      firstMeetingDate: b.firstMeetingDate,
      lastMeetingDate: b.lastMeetingDate,
    }));
    return {
      result: {
        yearlyCounts,
        topCommittees,
        selectedYear,
        totalCommittees,
        committeesInScope: rank.distinctCommittees,
        meetingsInScope: rank.totalMeetings,
      },
      esTookMs: null,
      hitsTotal: topCommittees.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Committee page (`/comisii/<committee_id>`): aggregates header / yearly
// counts in one search, then fetches the meeting list for the selected year
// in a second pass. Returns null when the committee_id has no meetings —
// the page calls notFound() in that case.

export async function committeePage(
  committeeId: string,
  opts: { year?: number } = {},
): Promise<CommitteePagePayload | null> {
  return timed("committeePage", { committeeId, ...opts }, async () => {
    const requestedYear =
      opts.year && opts.year >= SESSION_YEAR_MIN && opts.year <= SESSION_YEAR_MAX
        ? opts.year
        : null;
    const headerRes = await esClient().search({
      index: ES_INDEX.committeeMeetings,
      size: 0,
      track_total_hits: true,
      query: { bool: { filter: [{ term: { committee_id: committeeId } }] } },
      aggs: {
        first_date: { min: { field: "meeting_date" } },
        last_date: { max: { field: "meeting_date" } },
        name_sample: {
          top_hits: {
            size: 1,
            sort: [{ meeting_date: { order: "desc" } }],
            _source: ["committee_name", "committee_kind", "joint_with"],
          },
        },
        by_year: {
          date_histogram: {
            field: "meeting_date",
            calendar_interval: "year",
            min_doc_count: 1,
            format: "yyyy",
          },
        },
      },
    });
    const totalMeetings = totalOf(headerRes.hits.total);
    if (totalMeetings === 0) {
      return { result: null, esTookMs: headerRes.took ?? null, hitsTotal: 0 };
    }
    const headerAggs = headerRes.aggregations as
      | {
          first_date: { value_as_string?: string };
          last_date: { value_as_string?: string };
          name_sample: {
            hits: { hits: Array<{ _source?: CommitteeMeetingNameSample }> };
          };
          by_year: { buckets: Array<{ key_as_string?: string; doc_count: number }> };
        }
      | undefined;
    const sample = headerAggs?.name_sample.hits.hits[0]?._source;
    const yearlyCounts: CommitteeYearCount[] = (headerAggs?.by_year.buckets ?? []).flatMap((b) => {
      const year = b.key_as_string ? Number.parseInt(b.key_as_string, 10) : Number.NaN;
      if (!Number.isInteger(year)) return [];
      if (year < SESSION_YEAR_MIN || year > SESSION_YEAR_MAX) return [];
      return [{ year, count: b.doc_count }];
    });
    const fallbackYear = yearlyCounts.at(-1)?.year ?? null;
    const selectedYear = requestedYear ?? fallbackYear;
    let meetings: MoCommitteeMeeting[] = [];
    let meetingsInYear = 0;
    if (selectedYear !== null) {
      const filters: QueryDslQueryContainer[] = [
        { term: { committee_id: committeeId } },
        {
          range: {
            meeting_date: {
              gte: `${selectedYear}-01-01`,
              lte: `${selectedYear}-12-31`,
            },
          },
        },
      ];
      const listRes = await esClient().search<MoCommitteeMeeting>({
        index: ES_INDEX.committeeMeetings,
        size: MAX_PAGE_SIZE,
        track_total_hits: true,
        query: { bool: { filter: filters } },
        sort: [{ meeting_date: { order: "desc" } }],
      });
      meetings = listRes.hits.hits.flatMap((h) => (h._source ? [h._source] : []));
      meetingsInYear = totalOf(listRes.hits.total);
    }
    return {
      result: {
        committeeId,
        name: sample?.committee_name ?? committeeId,
        kind: sample?.committee_kind ?? null,
        jointWith: sample?.joint_with && sample.joint_with.length > 0 ? sample.joint_with : null,
        firstMeetingDate: headerAggs?.first_date.value_as_string ?? null,
        lastMeetingDate: headerAggs?.last_date.value_as_string ?? null,
        totalMeetings,
        yearlyCounts,
        selectedYear,
        meetings,
        meetingsInYear,
      },
      esTookMs: headerRes.took ?? null,
      hitsTotal: meetings.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Speeches search: BM25 default, optional client-side RRF fusion with kNN.

export type SpeechSort = "relevance" | "date-desc" | "date-asc";

export interface SearchSpeechesParams {
  q?: string;
  speakerPersonId?: string;
  chamber?: Chamber;
  // Multi-year filter — speeches from any year in the list. Maps to a `terms`
  // filter on `mo-speeches.year` (keyword in the index, indexed alongside
  // `session_date`). Mutually exclusive with `dateFrom`/`dateTo` at the page
  // level — when both are set, years wins (matches the documented chip-first
  // UX). Empty array is the same as "no year filter".
  years?: number[];
  dateFrom?: string;
  dateTo?: string;
  refBills?: string[];
  topics?: string[];
  // Raw `speaker.party_group_at_time` values (already de-slugged by the caller
  // via `listPartyEnumeration`). Multiple raw values are OR'd because the same
  // logical group may appear under several spellings in the corpus.
  speakerPartyRaw?: string[];
  // Discourse-analysis filters (Hawkins / V-Party / DQI). Sparse: only
  // populated for substantive speeches that have been LLM-coded by
  // `monitorul-ii analyze`. Records without discourse data are excluded
  // when any of these filters is set; pass `discourseRequired: true`
  // explicitly when you want to scope to coded records without filtering
  // on a score. See `../monitorul/docs/discourse-and-semantic-search.md`
  // for the seven canonical query patterns.
  hawkinsScores?: Array<0 | 1 | 2>;
  vpartyScores?: Array<0 | 1 | 2>;
  dqiLevelMin?: 0 | 1 | 2 | 3;
  discourseRequired?: boolean;
  isSubstantive?: boolean;
  page?: number;
  pageSize?: number;
  rankFusion?: "rrf" | "bm25-only";
  // Server-side sort. "relevance" leans on the BM25 / RRF score; the other two
  // force a `session_date` sort regardless of `q`. When `q` is empty,
  // "relevance" auto-resolves to "date-desc" inside the search functions.
  sort?: SpeechSort;
}

function speechFilters(p: SearchSpeechesParams): QueryDslQueryContainer[] {
  const filters: QueryDslQueryContainer[] = [];
  const isSubstantive = p.isSubstantive ?? true; // public default
  filters.push({ term: { is_substantive: isSubstantive } });
  if (p.speakerPersonId) filters.push({ term: { "speaker.person_id": p.speakerPersonId } });
  if (p.chamber) filters.push({ term: { chamber: p.chamber } });
  // Years take precedence over a custom range — chip selection is the
  // documented common case and the URL contract rebuilds it from `?year=`.
  if (p.years && p.years.length > 0) {
    filters.push({ terms: { year: p.years } });
  } else if (p.dateFrom || p.dateTo) {
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
  if (p.speakerPartyRaw && p.speakerPartyRaw.length > 0) {
    filters.push({ terms: { "speaker.party_group_at_time": p.speakerPartyRaw } });
  }
  // Discourse filters. `terms` over the byte-typed score fields is the
  // cheapest possible filter (cardinality 3); the `exists` clause for
  // `discourseRequired` excludes records that haven't been coded yet.
  if (p.hawkinsScores && p.hawkinsScores.length > 0) {
    filters.push({ terms: { "enrichments.discourse.hawkins.score": p.hawkinsScores } });
  }
  if (p.vpartyScores && p.vpartyScores.length > 0) {
    filters.push({ terms: { "enrichments.discourse.vparty.score": p.vpartyScores } });
  }
  if (p.dqiLevelMin !== undefined) {
    filters.push({
      range: { "enrichments.discourse.dqi.level_of_justification": { gte: p.dqiLevelMin } },
    });
  }
  if (p.discourseRequired) {
    filters.push({ exists: { field: "enrichments.discourse" } });
  }
  return filters;
}

// Resolves the requested sort to a concrete order. "relevance" with a non-empty
// `q` means "let BM25/RRF score do it" (caller passes `undefined` to ES);
// without `q` there's nothing to score against, so degrade to date-desc.
function resolveSort(p: SearchSpeechesParams): SpeechSort {
  const requested = p.sort ?? "relevance";
  if (requested === "relevance" && !p.q?.trim()) return "date-desc";
  return requested;
}

function dateSortClause(order: "asc" | "desc"): SearchRequest["sort"] {
  return [
    { session_date: { order, missing: "_last" } },
    { position_in_document: { order: "asc", missing: "_last" } },
  ];
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
    sort: bm25SortClause(p),
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

// BM25 sort: undefined (ES default = score desc) for relevance with `q`,
// explicit date sort otherwise. `resolveSort` already handles the "no q +
// relevance" → date-desc fallback.
function bm25SortClause(p: SearchSpeechesParams): SearchRequest["sort"] | undefined {
  const sort = resolveSort(p);
  if (sort === "relevance") return undefined;
  return dateSortClause(sort === "date-asc" ? "asc" : "desc");
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

// ---------------------------------------------------------------------------
// Ids-only legs for RRF.
//
// The fusion math (`fuseRrfIds`) only needs each leg's ranked id list, so the
// pool fetches return `_source: false` and no highlights. The 20-doc page
// slice is materialised in one shot via `fetchSpeechesByIds` after fusion.
//
// Cold-cache impact measured against `mo-speeches-20260506-v1` (817K docs,
// 24 segments/shard, BBQ-HNSW): kNN k=100/nc=1000 dropped from ~1.5 s with
// `_source` to ~100 ms ids-only; BM25 size=100 with highlights+source dropped
// from ~900 ms to ~120 ms ids-only. Highlights move to the page-slice fetch
// where they only run on the 20 hits actually rendered.

interface BmIdsLegResult {
  ids: string[];
  total: number;
  tookMs: number;
}

interface KnnIdsLegResult {
  ids: string[];
  tookMs: number;
}

async function bm25LegIds(
  p: SearchSpeechesParams,
  filters: QueryDslQueryContainer[],
  size: number,
): Promise<BmIdsLegResult> {
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
    from: 0,
    size,
    track_total_hits: true,
    query: { bool: { must, filter: filters } },
    _source: false,
    sort: bm25SortClause(p),
  });
  return {
    ids: res.hits.hits.flatMap((h) => (h._id ? [h._id] : [])),
    total: totalOf(res.hits.total),
    tookMs: res.took ?? 0,
  };
}

async function knnLegIds(
  vector: number[],
  filters: QueryDslQueryContainer[],
  k: number,
): Promise<KnnIdsLegResult> {
  const res = await esClient().search<MoSpeech>({
    index: ES_INDEX.speeches,
    size: k,
    knn: {
      field: "enrichments.embedding",
      query_vector: vector,
      k,
      num_candidates: Math.max(RRF_NUM_CANDIDATES_FLOOR, k * RRF_NUM_CANDIDATES_MULT),
      filter: filters,
    },
    _source: false,
  });
  return {
    ids: res.hits.hits.flatMap((h) => (h._id ? [h._id] : [])),
    tookMs: res.took ?? 0,
  };
}

// Materialise the page slice after fusion. One ES call: `ids` query for the
// page-sized list, with optional highlight via `highlight_query` so the
// snippet logic still runs against the user's text query (separate from the
// id-lookup query). Result is reordered to match the input id list (ES
// doesn't guarantee response order matches the `ids.values` order, and the
// fusion ordering is what the UI must render).
async function fetchSpeechesByIds(
  ids: string[],
  q: string | undefined,
): Promise<{ hits: MoSpeech[]; highlights: Record<string, string> }> {
  if (ids.length === 0) return { hits: [], highlights: {} };
  const trimmed = q?.trim();
  const highlightBlock = trimmed
    ? {
        highlight_query: {
          multi_match: {
            query: trimmed,
            fields: SPEECH_SEARCH_FIELDS,
            type: "best_fields" as const,
            operator: "or" as const,
          },
        },
        fields: {
          text: {
            number_of_fragments: 1,
            fragment_size: 220,
            matched_fields: ["text", "text.folded"],
            type: "unified" as const,
          },
          agenda_title: {
            number_of_fragments: 0,
            matched_fields: ["agenda_title", "agenda_title.folded"],
            type: "unified" as const,
          },
        },
        pre_tags: ["<mark>"],
        post_tags: ["</mark>"],
      }
    : undefined;
  const res = await esClient().search<MoSpeech>({
    index: ES_INDEX.speeches,
    size: ids.length,
    query: { ids: { values: ids } },
    _source: { excludes: ["enrichments.embedding"] },
    highlight: highlightBlock,
  });
  const byId = new Map<string, { doc: MoSpeech; snippet?: string }>();
  for (const h of res.hits.hits) {
    if (!h._source) continue;
    const snippet = h.highlight?.text?.[0] ?? h.highlight?.agenda_title?.[0];
    byId.set(h._source.record_id, { doc: h._source, snippet });
  }
  const hits: MoSpeech[] = [];
  const highlights: Record<string, string> = {};
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) continue;
    hits.push(entry.doc);
    if (entry.snippet) highlights[id] = entry.snippet;
  }
  return { hits, highlights };
}

// Reciprocal Rank Fusion. score(id) = Σ over legs of 1 / (rank_constant + rank_in_leg).
// Ids that appear in both legs accumulate higher than those that appear in one.
// Insertion order in the input legs IS the rank (1-indexed).
//
// Operates on `record_id` arrays so the legs can fetch ids only (no `_source`)
// — the page slice is materialised once via `fetchSpeechesByIds` after fusion.
// On the BBQ-HNSW kNN leg this is a 10–15× win on cold cache (336 KB of full
// source vs 10 KB of ids for a 100-hit pool).
//
// Tiebreaker: id ascending. Mirrors the Python sibling's
// `sorted(rrf_scores.keys(), key=lambda d: (-rrf_scores[d], d))` so identical
// queries produce identical orderings across both code paths — important for
// cache-key stability and reproducibility of any analytics that join on
// (query, position) pairs.
function fuseRrfIds(legs: string[][], rankConstant: number = RRF_RANK_CONSTANT): string[] {
  const scored = new Map<string, number>();
  for (const leg of legs) {
    leg.forEach((id, i) => {
      const rank = i + 1;
      const score = 1 / (rankConstant + rank);
      scored.set(id, (scored.get(id) ?? 0) + score);
    });
  }
  return Array.from(scored.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .map(([id]) => id);
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

  const q = p.q?.trim();
  if (!q) return searchSpeechesBm25(p, page, pageSize);

  const filters = speechFilters(p);

  // Fire BM25 and the embed call in parallel — BM25 doesn't need the vector,
  // and the embed call dominates the non-ES cost (~1 s in production). kNN
  // chains onto the embed promise so it kicks off the moment the vector is
  // ready, not after BM25 returns. Total wall-clock = max(BM25_ids, embed +
  // kNN_ids) + page fetch, vs the old embed + max(BM25, kNN).
  const bm25Promise = bm25LegIds(p, filters, poolSize);
  const knnPromise = embedQuery(q).then((vector) =>
    vector ? knnLegIds(vector, filters, poolSize) : null,
  );
  const [bm25, knn] = await Promise.all([bm25Promise, knnPromise]);

  // Embed unreachable: degrade to BM25-only — Q8 contract, never serve a
  // stale or absent vector. The BM25 pool is already in hand, so we slice it
  // to the page and fetch full source in one shot rather than re-querying.
  if (!knn) {
    const pageIds = bm25.ids.slice(offset, offset + pageSize);
    const fetched = await fetchSpeechesByIds(pageIds, q);
    return {
      hits: fetched.hits,
      total: bm25.total,
      page,
      pageSize,
      tookMs: bm25.tookMs,
      highlights: Object.keys(fetched.highlights).length > 0 ? fetched.highlights : undefined,
      mode: "bm25-only",
    };
  }

  // BM25 is the relevance gate. BGE-M3 produces a vector for any input
  // (including gibberish), so kNN always returns its top-k — even for
  // nonsense queries it surfaces 100 weakly-related "neighbours" at
  // similarity scores ~0.74 (vs ~0.79 for real semantic matches). To avoid
  // hallucinating results, kNN is only fused into the final list when BM25
  // has found at least one lexical anchor. Typos with at least one BM25
  // hit (e.g. "educatie" matching the archaic "educațiunii") still benefit
  // from kNN's expansion.
  const knnIdsForFusion = bm25.ids.length > 0 ? knn.ids : [];
  const fusedIds = fuseRrfIds([bm25.ids, knnIdsForFusion]);
  const pageIds = fusedIds.slice(offset, offset + pageSize);

  // Materialise the page slice (full source + highlights). One ES call.
  const fetched = await fetchSpeechesByIds(pageIds, q);

  // Total: take max of BM25's lexical total and the fused-pool size. This
  // matters when BM25 finds few hits (e.g. typo / no-diacritic query) but
  // kNN adds dozens of semantic neighbours — the user sees ~poolSize results
  // on screen and "1 rezultat" in the header would be a lie. Past poolSize
  // we trust BM25's total because that's what the deep-paging fallback can
  // actually serve.
  const total = Math.max(bm25.total, fusedIds.length);

  return {
    hits: fetched.hits,
    total,
    page,
    pageSize,
    // Legs ran in parallel; report the slower one as the wall-clock cost.
    // The page-slice fetch is small and uncounted (it's a downstream cost
    // shared with the BM25-only fallback).
    tookMs: Math.max(bm25.tookMs, knn.tookMs),
    highlights: Object.keys(fetched.highlights).length > 0 ? fetched.highlights : undefined,
    mode: "rrf",
  };
}

export async function searchSpeeches(
  params: SearchSpeechesParams,
): Promise<SearchResult<MoSpeech>> {
  const page = params.page ?? 1;
  const pageSize = clampPageSize(params.pageSize);
  return timed("searchSpeeches", { ...params, pageSize, page }, async () => {
    // Explicit date sort bypasses RRF — fusing semantic rank with chronological
    // order is incoherent (the kNN leg's "neighbours" don't mean anything once
    // you're saying "give me oldest first"). BM25-only handles date sorts
    // natively via `bm25SortClause`.
    const sortIsDate = resolveSort(params) !== "relevance";
    const useRrf =
      (params.rankFusion ?? "rrf") === "rrf" && Boolean(params.q?.trim()) && !sortIsDate;
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
// Party-at-time enumeration: distinct values of `speaker.party_group_at_time`
// across the corpus, sorted by speech count desc. Drives the `?party=`
// dropdown on /cauta. Slugs are minted here so the URL contract stays in this
// layer (callers de-slug back to raw values via `dePartySlugs`).

export interface PartyEnumerationRow {
  slug: string;
  raw: string;
  count: number;
}

const PARTY_ENUM_AGG_SIZE = 80;

// `speaker.party_group_at_time` is free-text; values like
// "Grupul parlamentar al PSD" are common alongside short forms ("PSD").
// We don't merge them in v1 (canon work belongs upstream in monitorul-ii) —
// the slug is just a URL-safe rendering of the raw value.
function slugifyParty(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// In-process memo. `speaker.party_group_at_time` enumeration changes glacially
// (new parties / spelling variants land via reindex). 1h TTL means at most one
// `terms` agg per process per hour; on Fluid Compute the same instance handles
// many requests, so this is effectively free across cache hits.
const PARTY_ENUM_TTL_MS = 60 * 60 * 1000;
let partyEnumCache: { rows: PartyEnumerationRow[]; expiresAt: number } | null = null;

export async function listPartyEnumeration(): Promise<PartyEnumerationRow[]> {
  const now = Date.now();
  if (partyEnumCache && partyEnumCache.expiresAt > now) {
    return partyEnumCache.rows;
  }
  return timed("listPartyEnumeration", {}, async () => {
    const res = await esClient().search({
      index: ES_INDEX.speeches,
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { is_substantive: true } },
            { exists: { field: "speaker.party_group_at_time" } },
          ],
        },
      },
      aggs: {
        by_party: {
          terms: {
            field: "speaker.party_group_at_time",
            size: PARTY_ENUM_AGG_SIZE,
            order: { _count: "desc" },
          },
        },
      },
    });
    const buckets =
      (
        res.aggregations as
          | { by_party: { buckets: Array<{ key: string; doc_count: number }> } }
          | undefined
      )?.by_party.buckets ?? [];
    // Slug collisions are possible (two raw values that fold to the same slug).
    // Disambiguate by appending the bucket index — rare but keeps the URL key
    // unique. The de-slug map preserves the raw → slug 1:1 mapping.
    const seen = new Set<string>();
    const rows: PartyEnumerationRow[] = [];
    buckets.forEach((b, i) => {
      let slug = slugifyParty(b.key);
      if (!slug || seen.has(slug)) slug = `${slug || "p"}-${i + 1}`;
      seen.add(slug);
      rows.push({ slug, raw: b.key, count: b.doc_count });
    });
    partyEnumCache = { rows, expiresAt: now + PARTY_ENUM_TTL_MS };
    return { result: rows, esTookMs: res.took ?? null, hitsTotal: rows.length };
  });
}

// Resolve a list of slugs back to the raw `speaker.party_group_at_time` values
// for the ES filter. Unknown slugs are dropped silently (a stale share-link
// shouldn't 500 the page).
export function dePartySlugs(slugs: string[], enumeration: PartyEnumerationRow[]): string[] {
  if (slugs.length === 0) return [];
  const map = new Map(enumeration.map((r) => [r.slug, r.raw]));
  return slugs.flatMap((s) => {
    const raw = map.get(s);
    return raw ? [raw] : [];
  });
}

// ---------------------------------------------------------------------------
// Persons

export interface SearchPersonsOptions {
  pageSize?: number;
  // When true, the last token in `q` is matched as a prefix — what an
  // as-you-type autocomplete needs. The default `false` keeps the historical
  // strict-AND behaviour for callers that want exact-token matches (e.g. SSR
  // slug → name resolution, where the slug expands to a full name).
  prefix?: boolean;
}

export async function searchPersons(
  q: string,
  pageSizeOrOptions?: number | SearchPersonsOptions,
): Promise<MoPerson[]> {
  const opts: SearchPersonsOptions =
    typeof pageSizeOrOptions === "number"
      ? { pageSize: pageSizeOrOptions }
      : (pageSizeOrOptions ?? {});
  const size = clampPageSize(opts.pageSize);
  const prefix = opts.prefix ?? false;
  return timed("searchPersons", { q, size, prefix }, async () => {
    if (!q.trim()) {
      return { result: [], esTookMs: null, hitsTotal: 0 };
    }
    // `bool_prefix` tokenises `q` and requires every term but the last to be
    // an exact match while the last is matched as a prefix — the right shape
    // for "Ioh" → Iohannis. Diacritic-folded subfields ride along so
    // `sosoaca` autocompletes to indexed `șoșoacă` for free.
    const queryBlock = prefix
      ? {
          multi_match: {
            query: q,
            fields: ["canonical_name^2", "canonical_name.folded", "aliases"],
            type: "bool_prefix" as const,
          },
        }
      : {
          multi_match: {
            query: q,
            fields: ["canonical_name^2", "canonical_name.folded", "aliases"],
            operator: "and" as const,
            type: "best_fields" as const,
          },
        };
    const res = await esClient().search<MoPerson>({
      index: ES_INDEX.persons,
      size,
      query: queryBlock,
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
// Page size for the year / no-filter views. Year scopes can run into hundreds
// of speeches for prolific speakers; `?page=N` paginates from there.
const PERSON_RECENT_PAGE_SIZE = 20;

export interface PersonPageOptions {
  year?: number;
  // `YYYY-MM-DD`. When set, the speeches list narrows to that single day and
  // the heatmap marks that cell. Year is derived from the day string.
  day?: string;
  // 1-indexed. Ignored on day-filtered views (those are exhaustive in one
  // shot, capped at `PERSON_DAY_SPEECH_LIMIT`).
  page?: number;
}

export async function personPage(
  slug: string,
  opts: PersonPageOptions = {},
): Promise<PersonPagePayload | null> {
  return timed(
    "personPage",
    { slug, year: opts.year, day: opts.day, page: opts.page },
    async () => {
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
      // Pagination only applies to year / no-filter views. Day filter is
      // exhaustive (single page, size = PERSON_DAY_SPEECH_LIMIT) per the
      // comment on that constant.
      const requestedPage = opts.page && opts.page > 0 ? Math.floor(opts.page) : 1;
      const pageSize = day ? PERSON_DAY_SPEECH_LIMIT : PERSON_RECENT_PAGE_SIZE;
      const fromOffset = day ? 0 : (requestedPage - 1) * pageSize;
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
          from: fromOffset,
          size: pageSize,
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
      const filteredSpeechTotal = totalOf(speechRes.hits.total);
      const totalPages = day ? 1 : Math.max(1, Math.ceil(filteredSpeechTotal / pageSize));
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
          filteredSpeechTotal,
          page: day ? 1 : requestedPage,
          pageSize,
          totalPages,
        },
        esTookMs: speechRes.took ?? null,
        hitsTotal: filteredSpeechTotal,
      };
    },
  );
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
