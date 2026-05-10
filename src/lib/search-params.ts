// URL-param parser for /cauta. The page hands us the raw `searchParams` Next 16
// async props give it; this module turns those into a typed CauseSearchParams
// shape used by the page render and the `searchSpeeches` call. Bad inputs are
// silently dropped (a stale share-link with `?chamber=foo` should render the
// search page, not 500 it).

import * as z from "zod";

import type { Chamber } from "./types";

// Shape Next 16 hands the page: every param value is `string | string[] | undefined`.
export type RawSearchParams = Record<string, string | string[] | undefined>;

// Page-cap matches the existing /cauta clamp (`pageNumber` returned ≤ 1000).
const MAX_PAGE = 1000;

// All sort + chamber slugs in one pace so the parser and the renderer stay in
// sync if either side adds a new value.
const CHAMBER_SLUGS = ["cd", "senat"] as const;
type ChamberSlug = (typeof CHAMBER_SLUGS)[number];

const SORT_VALUES = ["relevance", "date-desc", "date-asc"] as const;
export type SortSlug = (typeof SORT_VALUES)[number];

// `cd` / `senat` are the URL-safe slug forms; the search layer expects the full
// `Chamber` value (Romanian, with diacritics) because that's what's indexed.
const CHAMBER_FROM_SLUG: Record<ChamberSlug, Chamber> = {
  cd: "Camera Deputaților",
  senat: "Senat",
};

const CHAMBER_TO_SLUG: Record<Chamber, ChamberSlug> = {
  "Camera Deputaților": "cd",
  Senat: "senat",
};

// Single-string coercer. Next 16 may hand us `string[]` for repeated params
// (`?q=a&q=b`); we only ever use the first value — the form never emits the
// repeat shape, so this is just a tolerant fallback.
const firstString = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return "";
    if (Array.isArray(v)) return (v[0] ?? "").trim();
    return v.trim();
  });

// `?from=` / `?to=` accept ISO `YYYY-MM-DD`. Anything else is dropped (the
// search layer's `dateFrom` / `dateTo` are then undefined and ES skips the
// range filter). Cheaper than a full Date-parse and good enough for a public
// share-link surface — invalid dates already silently produced empty results
// pre-this-change.
const isoDate = firstString.transform((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""));

// Comma-separated year list. `?year=2024,2007` → [2024, 2007]. Single values
// (`?year=2024`) parse to a one-element array. Bad tokens are dropped silently.
const yearList = firstString.transform((v) => {
  if (!v) return [] as number[];
  const tokens = v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of tokens) {
    const n = Number.parseInt(t, 10);
    if (!Number.isInteger(n) || n < 1990 || n > 2100) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
});

const pageInt = firstString.transform((v) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_PAGE);
});

const chamberSlug = firstString.transform((v): ChamberSlug | null =>
  (CHAMBER_SLUGS as readonly string[]).includes(v) ? (v as ChamberSlug) : null,
);

const sortSlug = firstString.transform(
  (v): SortSlug => ((SORT_VALUES as readonly string[]).includes(v) ? (v as SortSlug) : "relevance"),
);

const truthyFlag = firstString.transform((v) => v === "1" || v === "true");

// Speaker / party slugs are URL-safe single tokens. Empty string = no filter.
const slugString = firstString.transform((v) => (v.length > 0 && v.length <= 120 ? v : ""));

// Comma-separated 0/1/2 list for the discourse score filter. Used for both
// `?hawkins=` and `?vparty=`. Bad / out-of-range tokens drop silently.
const HV_SCORE_LIST = firstString.transform((v) => {
  if (!v) return [] as Array<0 | 1 | 2>;
  const seen = new Set<number>();
  const out: Array<0 | 1 | 2> = [];
  for (const t of v.split(",")) {
    const n = Number.parseInt(t.trim(), 10);
    if (n === 0 || n === 1 || n === 2) {
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n as 0 | 1 | 2);
      }
    }
  }
  return out;
});

// Single integer 1/2/3 for the DQI level threshold (level_of_justification
// `>=`). 0 maps to "no filter" so the chip-toggle can de-select cleanly.
const DQI_LEVEL = firstString.transform((v): 1 | 2 | 3 | null => {
  const n = Number.parseInt(v, 10);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
});

// Voice mode chip from the discourse-UI rollout. Only "all" is a non-default
// value; everything else (empty, "first-person", anything else) parses as
// the default "first-person".
const VOICE_MODE = firstString.transform((v): "first-person" | "all" =>
  v === "all" ? "all" : "first-person",
);

// Confidence chip — only "07" is honored as a non-default. Anything else
// parses as `null` (no threshold).
const CONFIDENCE_MIN = firstString.transform((v): number | null => (v === "07" ? 0.7 : null));

const Schema = z.object({
  q: firstString,
  page: pageInt,
  from: isoDate,
  to: isoDate,
  // `?year=2024,2007` — comma-separated multi-year filter. Empty array means
  // "no year filter". Both this and from/to may legally appear in the URL;
  // the page resolves precedence (years wins) and `searchSpeeches` never
  // receives both.
  year: yearList,
  chamber: chamberSlug,
  speaker: slugString,
  party: slugString,
  procedural: truthyFlag,
  sort: sortSlug,
  // Discourse-UI Phase 5 chips.
  hawkins: HV_SCORE_LIST,
  vparty: HV_SCORE_LIST,
  dqi: DQI_LEVEL,
  voice: VOICE_MODE,
  conf: CONFIDENCE_MIN,
});

export interface CautaSearchParams {
  q: string;
  page: number;
  // Years selected via the chip UI. Empty array = no year filter. Mutually
  // exclusive with `dateFrom`/`dateTo` at the URL level — when both appear,
  // years wins and dateFrom/dateTo are ignored by the page (still preserved in
  // the parsed shape for transparency).
  years: number[];
  // Custom date range, used only when `years` is empty. Both empty = no range.
  dateFrom: string;
  dateTo: string;
  chamber: Chamber | null;
  // Person slug as stored in the URL — passed straight to ES as
  // `speaker.person_id` (the slug equals the person_id by upstream construction).
  speakerSlug: string;
  partySlug: string;
  // True when the user opted to include procedural turns; default false maps
  // to the search layer's `isSubstantive: true` default.
  includeProcedural: boolean;
  sort: SortSlug;
  // Phase 5 discourse filters — see CLAUDE.md "Search rule" + the
  // `searchSpeeches` filter primitives in `src/lib/search.ts` (already exists
  // since the discourse layer was indexed).
  hawkinsScores: Array<0 | 1 | 2>;
  vpartyScores: Array<0 | 1 | 2>;
  dqiLevelMin: 1 | 2 | 3 | null;
  voiceMode: "first-person" | "all";
  confidenceMin: number | null;
}

export function parseCautaSearchParams(raw: RawSearchParams): CautaSearchParams {
  const parsed = Schema.parse(raw);
  return {
    q: parsed.q,
    page: parsed.page,
    years: parsed.year,
    dateFrom: parsed.from,
    dateTo: parsed.to,
    chamber: parsed.chamber ? CHAMBER_FROM_SLUG[parsed.chamber] : null,
    speakerSlug: parsed.speaker,
    partySlug: parsed.party,
    includeProcedural: parsed.procedural,
    sort: parsed.sort,
    hawkinsScores: parsed.hawkins,
    vpartyScores: parsed.vparty,
    dqiLevelMin: parsed.dqi,
    voiceMode: parsed.voice,
    confidenceMin: parsed.conf,
  };
}

// Build a `/cauta?…` URL from the parsed shape. Used by:
//  - pagination links
//  - active-filter chip "remove" links (callers pass an override clearing one field)
//  - year-chip links
// Empty / default values are omitted so URLs stay terse and shareable.
export function buildCautaHref(
  params: CautaSearchParams,
  overrides: Partial<CautaSearchParams> = {},
): string {
  const merged: CautaSearchParams = { ...params, ...overrides };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  // years wins over from/to in the URL — keeps the link short for the
  // common chip-driven case.
  if (merged.years.length > 0) {
    // Stable order makes share-links deterministic. Sorted ascending.
    const sorted = [...merged.years].sort((a, b) => a - b);
    sp.set("year", sorted.join(","));
  } else {
    if (merged.dateFrom) sp.set("from", merged.dateFrom);
    if (merged.dateTo) sp.set("to", merged.dateTo);
  }
  if (merged.chamber) sp.set("chamber", CHAMBER_TO_SLUG[merged.chamber]);
  if (merged.speakerSlug) sp.set("speaker", merged.speakerSlug);
  if (merged.partySlug) sp.set("party", merged.partySlug);
  if (merged.includeProcedural) sp.set("procedural", "1");
  if (merged.sort !== "relevance") sp.set("sort", merged.sort);
  if (merged.hawkinsScores.length > 0) {
    sp.set("hawkins", [...merged.hawkinsScores].sort((a, b) => a - b).join(","));
  }
  if (merged.vpartyScores.length > 0) {
    sp.set("vparty", [...merged.vpartyScores].sort((a, b) => a - b).join(","));
  }
  if (merged.dqiLevelMin !== null) sp.set("dqi", String(merged.dqiLevelMin));
  if (merged.voiceMode === "all") sp.set("voice", "all");
  if (merged.confidenceMin === 0.7) sp.set("conf", "07");
  if (merged.page > 1) sp.set("page", String(merged.page));
  const qs = sp.toString();
  return qs ? `/cauta?${qs}` : "/cauta";
}

// Count of "non-default" filters — drives the `<summary>Filtre · N</summary>`
// badge. `q`, `page`, and `sort` are never counted; they're not "filters" in
// the editorial sense — they're the search itself. Multi-year selection
// counts as one filter dimension, not N.
export function activeFilterCount(p: CautaSearchParams): number {
  let n = 0;
  if (p.years.length > 0 || p.dateFrom || p.dateTo) n += 1;
  if (p.chamber) n += 1;
  if (p.speakerSlug) n += 1;
  if (p.partySlug) n += 1;
  if (p.includeProcedural) n += 1;
  if (p.hawkinsScores.length > 0) n += 1;
  if (p.vpartyScores.length > 0) n += 1;
  if (p.dqiLevelMin !== null) n += 1;
  if (p.voiceMode === "all") n += 1;
  if (p.confidenceMin !== null) n += 1;
  return n;
}
