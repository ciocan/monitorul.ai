import "server-only";

import { env } from "@/env";

import { requestContext } from "./request-context";
import type { MoPerson, MoSpeech } from "./types";

// Re-export the AsyncLocalStorage handle so existing imports
// (`import { requestContext } from "@/lib/mcp-adapters"`) stay valid even
// though the storage definition itself now lives in `request-context.ts` —
// `search.ts.logQuery` needs to read it too, and decoupling from
// `mcp-adapters` keeps the MCP layer a leaf module.
export { requestContext } from "./request-context";

// Trims a `MoSpeech` ES hit to the cataloguer-mode shape consumed by every
// search-shape MCP tool (docs/mcp.md §"Hit shape contract").
//
// The trim has two jobs:
//
//   1. Cap the per-hit context budget so a 20-hit page fits the LLM's window
//      with room to compose multi-step calls. Bodies stay behind get_speech.
//   2. Pin every hit to a one-click-verifiable absolute URL on this same
//      origin — the citation surface a journalist or fact-checker can paste.
//
// Highlights come from the `searchSpeeches` `highlights` map (record_id →
// snippet); the adapter falls back to the first 240 chars of the body when
// the highlighter returned nothing (typically a kNN-only match where no BM25
// terms hit). When `text` is also missing (e.g. the `_source.excludes` shape
// drops it for kNN-only ablation) the excerpt is empty — preferable to
// inventing one.

const EXCERPT_FALLBACK_CHARS = 240;

export interface CatalogueHit {
  record_id: string;
  url_path: string;
  absolute_url: string;
  document_id: string;
  document_url_path: string;
  // In-context reading anchor on the parent document, when derivable
  // (`/mo/<year>/<part>/<issue>#discurs-<position>`). Distinct from
  // `url_path`, which is the canonical standalone speech-detail page —
  // LLMs that want to surface "read in the original sitting" pick this.
  document_anchor_url_path: string | null;
  speaker: {
    person_id: string | null;
    canonical_name: string;
    slug: string | null;
    party_group: string | null;
  };
  date: string | null;
  chamber: string | null;
  agenda_title: string | null;
  excerpt: string;
  refs: {
    bills: string[];
    laws: string[];
    codes: string[];
  };
}

function siteOrigin(): string {
  // Per-request override (set by the MCP route handler) wins. Falls back to
  // the build-time env value for non-MCP callers and unit-test scenarios.
  const ctx = requestContext.getStore();
  if (ctx?.origin) return ctx.origin.replace(/\/$/, "");
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

function fallbackExcerpt(text: string | undefined): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= EXCERPT_FALLBACK_CHARS) return trimmed;
  return `${trimmed.slice(0, EXCERPT_FALLBACK_CHARS).trimEnd()}…`;
}

// Reconstruct the document URL path from the speech's mo_issue + year. The
// upstream `mo-speeches` document carries `year` and `mo_issue` (e.g.
// `MO-P1-123-2024`), and the doc URL pattern is `/mo/<year>/<part>/<issue>`.
// Splitting `mo_issue` is brittle (formats vary by year), so when the
// shape isn't predictable we leave the document_url_path empty rather than
// minting a 404-bound link.
function deriveDocumentUrlPath(speech: MoSpeech): string {
  // Prefer an explicit document_id of the form `mo://YYYY/PART/ISSUE` (the
  // canonical record_id shape). When present we map directly to the URL
  // template.
  const moMatch = /^mo:\/\/(\d{4})\/([^/]+)\/([^/#]+)/.exec(speech.document_id);
  if (moMatch) {
    return `/mo/${moMatch[1]}/${moMatch[2]}/${moMatch[3]}`;
  }
  return "";
}

// Resolve the canonical URL for a speech: the standalone `/discurs/<slug>`
// detail page, minted slug-once upstream and shipped on this app as the
// citation surface. When the speech record is missing both `url_path` and
// `slug` (transitional records pre-`extraction.identity` backfill) we fall
// back to the in-doc anchor so the LLM still hands the user a 200-able link.
function resolveSpeechUrlPath(speech: MoSpeech, documentAnchorPath: string | null): string {
  if (speech.url_path) return speech.url_path;
  if (speech.slug) return `/discurs/${speech.slug}`;
  if (documentAnchorPath) return documentAnchorPath;
  return "/";
}

function deriveDocumentAnchorPath(speech: MoSpeech, documentUrlPath: string): string | null {
  if (!documentUrlPath) return null;
  if (speech.position_in_document != null) {
    return `${documentUrlPath}#discurs-${speech.position_in_document}`;
  }
  return documentUrlPath;
}

export function toCatalogueHit(speech: MoSpeech, highlight: string | undefined): CatalogueHit {
  const origin = siteOrigin();
  const document_url_path = deriveDocumentUrlPath(speech);
  const document_anchor_url_path = deriveDocumentAnchorPath(speech, document_url_path);
  const url_path = resolveSpeechUrlPath(speech, document_anchor_url_path);
  const personId = speech.speaker.person_id;
  const canonical_name = speech.speaker.name_search ?? speech.speaker.name_raw;
  const excerpt = highlight && highlight.trim() ? highlight : fallbackExcerpt(speech.text);
  return {
    record_id: speech.record_id,
    url_path,
    absolute_url: `${origin}${url_path}`,
    document_id: speech.document_id,
    document_url_path,
    document_anchor_url_path,
    speaker: {
      person_id: personId,
      canonical_name,
      // person_id IS the slug in `mo-persons` — verified contract per
      // CLAUDE.md ("person_id === slug"). Null when the speech speaker
      // wasn't entity-resolved.
      slug: personId,
      party_group: speech.speaker.party_group_at_time,
    },
    date: speech.session_date,
    chamber: speech.chamber,
    agenda_title: speech.agenda_title || null,
    excerpt,
    refs: {
      bills: speech.refs.bills ?? [],
      laws: speech.refs.laws ?? [],
      codes: speech.refs.codes ?? [],
    },
  };
}

// Persons cataloguer hit shape — same idea, scoped to MP/minister/chair
// directory entries returned by `search_persons`.
export interface PersonHit {
  person_id: string;
  url_path: string;
  absolute_url: string;
  canonical_name: string;
  homonym_disambiguation: string | null;
  aliases: string[];
  // Latest mandate role (chamber + party + dates), if any.
  latest_mandate: {
    role: string;
    chamber: string | null;
    party: string | null;
    from: string | null;
    to: string | null;
  } | null;
  stats: {
    speech_count: number | null;
    first_speech_date: string | null;
    last_speech_date: string | null;
  };
}

export function toPersonHit(person: MoPerson): PersonHit {
  const origin = siteOrigin();
  const url_path = person.url_path ?? `/politicieni/${person.slug}`;
  const mandates = person.mandates ?? [];
  // Pick the mandate with the latest `from` date — the registry is rarely
  // sorted upstream, so we compute it here.
  const latest = mandates
    .slice()
    .sort((a, b) => {
      const ax = a.from ?? "";
      const bx = b.from ?? "";
      return ax < bx ? 1 : ax > bx ? -1 : 0;
    })
    .at(0);
  return {
    person_id: person.id,
    url_path,
    absolute_url: `${origin}${url_path}`,
    canonical_name: person.canonical_name,
    homonym_disambiguation: person.homonym_disambiguation,
    aliases: person.aliases ?? [],
    latest_mandate: latest
      ? {
          role: latest.role,
          chamber: latest.chamber,
          party: latest.party,
          from: latest.from,
          to: latest.to,
        }
      : null,
    stats: {
      speech_count: person.stats?.speech_count ?? null,
      first_speech_date: person.stats?.first_speech_date ?? null,
      last_speech_date: person.stats?.last_speech_date ?? null,
    },
  };
}
