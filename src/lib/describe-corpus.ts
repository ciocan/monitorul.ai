import "server-only";

import { env } from "@/env";

import { ES_INDEX, esClient } from "./es-client";
import { requestContext } from "./mcp-adapters";

// MCP `describe_corpus` data source. Single round-trip aggregation that lets a
// LLM client self-bootstrap on first use: chambers / topic enumeration / count
// per grain / archive date range / URL templates that round-trip to citation
// links on this same site.
//
// The doc target (docs/mcp.md §"Discoverability — describe_corpus") spells out
// the exact return shape; this module is the lone caller-side concern.

export interface CorpusDescription {
  enums: {
    chambers: string[];
    // Distinct `mo-speeches.enrichments.topics` slugs across the corpus,
    // sorted by speech-count desc and capped at 30. Keeps the system prompt
    // budget tight while still surfacing every active topic in practice.
    topics: string[];
    // Distinct `mo-agenda-items.refs.types` values (`"bill"`, `"law"`,
    // `"oug"`, …). Drives the `agg_speeches_by_party_year` and search
    // tools' `ref_types` filter awareness in the LLM.
    reference_types: string[];
  };
  url_templates: {
    document: string;
    speech: string;
    person: string;
    committee: string;
  };
  counts: {
    documents?: number;
    speeches?: number;
    substantive_speeches?: number;
    votes?: number;
    interpellations?: number;
    questions?: number;
    committee_meetings?: number;
    reports?: number;
    persons?: number;
    agenda_items?: number;
  };
  date_range: {
    earliest: string | null;
    latest: string | null;
  };
  routing_hints: string;
}

const TOPIC_AGG_SIZE = 30;
const REFERENCE_TYPE_AGG_SIZE = 20;

const ROUTING_HINTS = `\
Sugestii de rutare (alege întâi cel mai specific tool):

- Întrebare în limbaj natural peste discursuri → search_speeches (implicit
  rank_fusion=rrf; folosește bm25-only pentru substantive proprii / acronime
  precum "PNRR" sau "Codul muncii").
- "Ce a spus parlamentarul X despre Y?" → search_persons → person_page →
  search_speeches cu speaker_person_id din înregistrarea persoanei.
- Redă o întreagă ședință → list_documents_by_date → list_document_children.
- Dosar de parlamentar → person_page (un singur apel returnează discursuri
  recente, statistici și heatmap de activitate).
- Dosar de comisie → committees_index sau committee_page.
- Agregări pe partide → agg_speeches_by_party_year.
- Apelează mereu get_speech(record_id) înainte de a cita verbatim — hit-urile
  de căutare returnează doar fragmente de ~240 caractere; textul integral este
  disponibil prin get_speech.
`;

interface TopicBucket {
  key: string;
  doc_count: number;
}

interface RefTypeBucket {
  key: string;
  doc_count: number;
}

// Distinct `chamber` values across the speech corpus. Indexed values diverge
// from the `Chamber` TypeScript union (which says `"Senat"` but the corpus
// has `"Senatul"`); surfacing the live enumeration is the only durable way to
// guide the LLM to a value that actually filters non-zero.
async function fetchChamberEnumeration(): Promise<string[]> {
  try {
    const res = await esClient().search({
      index: ES_INDEX.speeches,
      size: 0,
      aggs: {
        chambers: {
          terms: {
            field: "chamber",
            size: 10,
            order: { _count: "desc" },
            min_doc_count: 1,
          },
        },
      },
    });
    const buckets =
      (res.aggregations as { chambers: { buckets: Array<{ key: string }> } } | undefined)?.chambers
        .buckets ?? [];
    return buckets.map((b) => b.key);
  } catch {
    return [];
  }
}

async function fetchTopicEnumeration(): Promise<string[]> {
  try {
    const res = await esClient().search({
      index: ES_INDEX.speeches,
      size: 0,
      query: { bool: { filter: [{ term: { is_substantive: true } }] } },
      aggs: {
        topics: {
          terms: {
            field: "enrichments.topics",
            size: TOPIC_AGG_SIZE,
            order: { _count: "desc" },
            min_doc_count: 1,
          },
        },
      },
    });
    const buckets =
      (res.aggregations as { topics: { buckets: TopicBucket[] } } | undefined)?.topics.buckets ??
      [];
    return buckets.map((b) => b.key);
  } catch {
    return [];
  }
}

async function fetchReferenceTypes(): Promise<string[]> {
  try {
    const res = await esClient().search({
      index: ES_INDEX.agendaItems,
      size: 0,
      aggs: {
        ref_types: {
          terms: {
            field: "refs.types",
            size: REFERENCE_TYPE_AGG_SIZE,
            order: { _count: "desc" },
            min_doc_count: 1,
          },
        },
      },
    });
    const buckets =
      (res.aggregations as { ref_types: { buckets: RefTypeBucket[] } } | undefined)?.ref_types
        .buckets ?? [];
    return buckets.map((b) => b.key);
  } catch {
    return [];
  }
}

async function fetchDateRange(): Promise<{ earliest: string | null; latest: string | null }> {
  try {
    const res = await esClient().search({
      index: ES_INDEX.documents,
      size: 0,
      aggs: {
        earliest: { min: { field: "session_date" } },
        latest: { max: { field: "session_date" } },
      },
    });
    const aggs = res.aggregations as
      | {
          earliest: { value_as_string?: string };
          latest: { value_as_string?: string };
        }
      | undefined;
    return {
      earliest: aggs?.earliest.value_as_string ?? null,
      latest: aggs?.latest.value_as_string ?? null,
    };
  } catch {
    return { earliest: null, latest: null };
  }
}

async function fetchCounts(): Promise<CorpusDescription["counts"]> {
  const c = esClient();
  const queries: Array<[keyof CorpusDescription["counts"], () => Promise<{ count: number }>]> = [
    ["documents", () => c.count({ index: ES_INDEX.documents })],
    ["agenda_items", () => c.count({ index: ES_INDEX.agendaItems })],
    ["speeches", () => c.count({ index: ES_INDEX.speeches })],
    [
      "substantive_speeches",
      () =>
        c.count({
          index: ES_INDEX.speeches,
          query: { term: { is_substantive: true } },
        }),
    ],
    ["votes", () => c.count({ index: ES_INDEX.votes })],
    ["interpellations", () => c.count({ index: ES_INDEX.interpellations })],
    ["questions", () => c.count({ index: ES_INDEX.questions })],
    ["committee_meetings", () => c.count({ index: ES_INDEX.committeeMeetings })],
    ["reports", () => c.count({ index: ES_INDEX.reports })],
    ["persons", () => c.count({ index: ES_INDEX.persons })],
  ];
  const settled = await Promise.allSettled(queries.map(([, fn]) => fn()));
  const counts: CorpusDescription["counts"] = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      counts[queries[i][0]] = r.value.count;
    }
  });
  return counts;
}

export async function describeCorpus(): Promise<CorpusDescription> {
  // Per-request origin override (set by the MCP route handler) wins, so the
  // url_templates the LLM sees match the host it's actually talking to. Falls
  // back to the build-time env value for non-MCP callers.
  const ctx = requestContext.getStore();
  const siteUrl = (ctx?.origin ?? env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  const [counts, dateRange, chambers, topics, referenceTypes] = await Promise.all([
    fetchCounts(),
    fetchDateRange(),
    fetchChamberEnumeration(),
    fetchTopicEnumeration(),
    fetchReferenceTypes(),
  ]);
  return {
    enums: {
      // Live distinct `chamber` values from `mo-speeches`. The `Chamber`
      // TypeScript union is aspirational ("Senat") but the corpus actually
      // stores "Senatul" — passing the live values is the only contract that
      // round-trips through `term: { chamber: ... }` filters non-zero. Falls
      // back to the type-union values if the agg fails.
      chambers: chambers.length > 0 ? chambers : ["Camera Deputaților", "Senat"],
      topics,
      reference_types: referenceTypes,
    },
    url_templates: {
      document: `${siteUrl}/mo/<year>/<part>/<issue>`,
      // The per-speech route hasn't shipped on monitorul.ai yet — speeches
      // are addressed via an anchor on the parent document page today. The
      // cataloguer in `mcp-adapters.ts` already mints the correct URL on each
      // hit; this template just documents the current shape so an LLM
      // constructing a URL from corpus knowledge alone doesn't 404.
      speech: `${siteUrl}/mo/<year>/<part>/<issue>#discurs-<position_in_document>`,
      person: `${siteUrl}/politicieni/<slug>`,
      committee: `${siteUrl}/comisii/<id>`,
    },
    counts,
    date_range: dateRange,
    routing_hints: ROUTING_HINTS,
  };
}
