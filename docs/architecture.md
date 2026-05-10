# Architecture

`monitorul.ai` is the public-facing read surface over the Elasticsearch indices produced by [`monitorul-ii`](https://github.com/ciocan/monitorul-ii). This document describes **what the data looks like in ES** and how the app consumes it. The shape is owned by `monitorul-ii`; this doc is a consumer-side summary — the canonical reference is `docs/elasticsearch-indexing.md` in that repo.

## Boundary

```
  monitorul-ii (Python)                  monitorul.ai (this repo)
  ─────────────────────                  ────────────────────────
  scrape PDFs ──▶ markdown ──▶ JSON      Next.js (App Router)
       │                                       │
       ▼                                       │  read-only via
  Elasticsearch  ◀──────────── reads ──────────┘  monitorul_reader
   `mo-*` aliases                                 API key
```

- `monitorul-ii` owns the data: scraping, OCR/markdown conversion, structured extraction, linking, embedding, and indexing.
- This app **only reads** from the `mo-*` indices. It never touches PDFs, markdown, or sidecars on disk.
- Elasticsearch is a derived projection, not the system of record. URLs published by this app must keep resolving across re-indexes — record identity is minted upstream and stable across schema bumps.

## Indices (grains)

Nine read-aliases under `mo-*`. Each one maps 1:1 to a URL pattern on the site.

| Index alias             | URL shape                                | What it represents                                                         |
| ----------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `mo-documents`          | `/mo/<year>/<part>/<issue>`              | One MO issue (envelope: chamber, session date, type, etc.)                 |
| `mo-agenda-items`       | `/mo/<year>/<part>/<issue>/agenda/<ord>` | One agenda item / debate within a plenary session                          |
| `mo-speeches`           | `/discurs/<slug>-<short_id>`             | One speech / activity by a single speaker                                  |
| `mo-votes`              | `/vot/<short_id>`                        | One recorded vote                                                          |
| `mo-interpellations`    | `/interpelare/<slug>-<short_id>`         | One interpellation (and its response, when present)                        |
| `mo-questions`          | `/intrebare/<regnum>-<regdate>`          | One written question from the Question Register                            |
| `mo-committee-meetings` | `/comisie/<committee_id>/<date>`         | One committee meeting (roster, agenda, votes)                              |
| `mo-reports`            | `/raport/<issuing_body_id>/<year>`       | One annual report from an institutional body                               |
| `mo-persons`            | `/politicieni/<slug>`                    | One politician (curated registry: parliamentarians, ministers, presidents) |

Why per-grain instead of one mega-index per MO: each grain has a different mapping (speeches need the Romanian text analyzer + dense_vector; votes are mostly numeric; reports are long-form), each gets its own SEO crawl budget, and each is independently re-indexable when only one changes upstream.

## Record identity

Every doc across every grain has a stable `record_id` minted upstream and used directly as the ES `_id`:

| Grain             | `record_id`                        |
| ----------------- | ---------------------------------- |
| Document          | `mo://YYYY/PART/ISSUE`             |
| Agenda item       | `<doc_id>#agenda-<ordinal>`        |
| Speech            | `<doc_id>#agenda-<ord>#act-<seq>`  |
| Vote              | `<doc_id>#agenda-<ord>#vote-<seq>` |
| Interpellation    | `<doc_id>#interp-<num>`            |
| Question          | `<doc_id>#q-<regnum>`              |
| Committee meeting | `<doc_id>#cmt-<committee_id>`      |
| Report            | `<doc_id>`                         |
| Person            | `<person_slug>`                    |

These IDs survive re-extractions and schema bumps. Pages and ISR cache tags key off them.

## Common fields (every grain)

```jsonc
{
  "record_id": "keyword",
  "document_id": "keyword",
  "content_fingerprint": "keyword", // sha256[:12] of normalised body — staleness sentinel
  "indexed_at": "date",
  "extractor_versions": {
    /* per-component, dynamic */
  },
  "enrichment_versions": {
    /* per-producer, dynamic */
  },
  "schema_version": "keyword",
}
```

Per-doc child grains additionally carry `position_in_document: integer` so the playback page can interleave agenda → speeches → votes → … in true source order across grains in a single multi-index search.

## Grain-specific shape (highlights)

The full v1 mappings live in `monitorul-ii`'s `src/monitorul_ii/elasticsearch/mappings/`. The fields the app touches most:

**`mo-speeches`** — the substrate for search.

- `chamber`, `session_date`, `legislature`, `year`, `mo_issue`
- `agenda_ordinal`, `agenda_title` (text, Romanian analyzer), `agenda_category`, `agenda_outcome`
- `speaker.{person_id, name_raw, name_search, title, role, party_group_at_time, delivery_mode}`
- `text` (Romanian analyzer + `text.exact` for phrase queries), `text_length`, `is_substantive` (true when `text_length ≥ 100`)
- `refs.{bills, laws, codes, ougs, ogs, types, raw}` — flat keyword arrays of cited references
- `enrichments.{topics, summary, embedding (1024-dim BGE-M3), embedding_text_fingerprint}`

**`mo-persons`** — `canonical_name` (text + folded), `aliases`, `wikidata_qid`, `birth_date`, `mandates[]` (role / chamber / legislature / from / to / party). Curated registry, not sidecar-derived.

**`mo-votes`** — `motion_type`, `voting_method`, `outcome`, `counts.{for, against, abstain}` (int | null | "unanimous"), `timing` (live/deferred), and linker fields `defers_to` / `resolves[]` for paired deferred votes across documents.

**`mo-interpellations`** — `questioner` (Speaker), `addressed_to` + `addressed_to_normalized` (canonical ministry id), `topic`, `question_text`, `response_deferred`, optional `response`.

**`mo-committee-meetings`** — `dates[]`, `time_windows[]`, `format`, `purpose`, `joint_with[]`, `roster[]` (presence + intra-committee role), `agenda[]` with per-item bill cites and outcomes.

**`mo-reports`** — `issuing_body` + `issuing_body_normalized`, `reporting_period.{start, end}`, `received_at`, `headings[]` (level + text), excerpt. Body markdown stays out of ES (reproduced verbatim per spec).

## Query layer

All ES access goes through one server-only module — [`src/lib/search.ts`](../src/lib/search.ts). No direct ES client in route handlers, no ad-hoc DSL in pages. The function set mirrors the Python `monitorul_ii.elasticsearch.queries` module name-for-name so the LLM-agent layer, the `monitorul-ii query` CLI, and this app all enforce the same guardrails.

Functions (current shape):

- `searchSpeeches({ q, speakerPersonId, chamber, years, dateFrom, dateTo, refBills, topics, speakerPartyRaw, isSubstantive, page, pageSize, rankFusion, sort })` — multi*match BM25 over the `SPEECH_SEARCH_FIELDS` constant (main fields `text^2` / `agenda_title^1.5` / `speaker.name_search` paired with their `.folded` subfields at lower boosts so no-diacritic queries like `sosoaca` still match indexed `șoșoacă` — see "Diacritic-insensitive search" below), fused with kNN over `enrichments.embedding` via RRF (default — see below). `years` is a multi-year filter — speeches from any listed year via `terms: { year: [...] }` on the indexed `mo-speeches.year` keyword; mutually exclusive with `dateFrom`/`dateTo` (years wins when both are set). `sort: "relevance" | "date-desc" | "date-asc"` controls the order: `relevance` (default) lets BM25 / RRF score do it and resolves to `date-desc` when `q` is empty; explicit date sorts force a `session_date` order regardless of `q` and bypass RRF entirely (chronological order doesn't compose with semantic rank — `searchSpeeches` falls back to BM25-only there). `speakerPartyRaw` is a list of \_raw* `speaker.party_group_at_time` values (already de-slugged by the caller via `dePartySlugs`), OR'd into a `terms` filter so multiple corpus spellings (`"PSD"` vs `"Grupul parlamentar al PSD"`) can map to the same logical group.
- `listPartyEnumeration()` — `terms` agg on `speaker.party_group_at_time` (filtered to substantive, sorted by count desc, size 80) returning `{ slug, raw, count }[]`. Slugs are minted server-side (lowercase + ASCII-folded + hyphenated, suffixed on collision); the list is memoised in-process for 1h. Drives the `/cauta` party-at-time `<select>` and the `dePartySlugs(slugs, enumeration)` helper that turns URL slugs back into the raw values fed to `searchSpeeches.speakerPartyRaw`.
- `searchSpeechesKnn` — pure kNN ablation; throws (no BM25 fallback) when the embed service is unreachable so callers can distinguish misconfig from "no semantic matches".
- `listDocumentChildren(documentId)` — multi-grain interleave for `/mo/<id>` playback, sorted by `position_in_document` ASC. Speech `text` is **kept** in the response (only `enrichments.embedding` is excluded) so the document page can render speech bodies inline; with ~50 speeches per stenogram and ISR 1h, the per-page payload is acceptable.
- `getDocument` / `getAgendaItem` / `getSpeech` / `getReport` — single lookup by `record_id`.
- `getSpeechBySlug(slug)` — slug-by-slug lookup powering `/discurs/<slug>`. Two-tier resolution: a fast-path `term` on the `slug` keyword field (O(1) on the inverted index), and a slow-path `wildcard: { slug: "*-<short_id>" }` bounded by `terminate_after: 1` for the slug-prefix-evolution case (renamed variant URL → canonical record). The short-id tail is matched with `/-([a-z2-7]{8,12})$/` against the requested slug — outside that shape we don't bother with the wildcard scan and return `null`. Returns the full `MoSpeech` (including `text`); the caller compares `speech.slug` to the requested slug to decide whether to 308-redirect.
- `listDocumentsByDate(date, chamber?)` / `listCommitteeMeetings(committeeId, dateFrom?)`
- `personPage(slug, { year?, day? })` — composite payload for `/politicieni/<slug>`. Two ES queries run in parallel: a **filtered** speech search narrowed to `year` or `day` (drives the speeches list, returns up to 50 hits for a day filter, 10 otherwise), and an **unfiltered** career-long aggregation (drives the year sparkbar + stats fallback). `day` implies year (parsed from the date string); a separate per-day `date_histogram` runs sequentially after for the heatmap of the selected calendar year.
- `committeesIndex({ year? })` — composite payload for `/comisii`. Per-year meeting counts via `date_histogram` on `meeting_date` (calendar_interval=year), top 100 committees by meeting count for the selected year via a `terms` agg on `committee_id` with sub-aggs (`first_date`, `last_date`, `name_sample` top_hits — same idiom as the politician rank), and a `cardinality` over `committee_id` for the archive-wide registry size. There is no upstream `mo-committees` index; the registry is derived live from `mo-committee-meetings`.
- `committeePage(committee_id, { year? })` — composite payload for `/comisii/<committee_id>`. One aggregation pass derives the header (latest-meeting `name`/`kind`/`joint_with` via `top_hits`, plus `min`/`max` meeting date and the per-year `date_histogram`); a follow-up `_search` lists meetings for the selected year (sorted by `meeting_date` desc, capped at 50). Returns `null` when the committee has zero meetings so the route can call `notFound()`.
- `searchPersons(q)` — `multi_match` with `operator: and` over `canonical_name` (+ `.folded` subfield) and `aliases`.
- `aggSpeechesByPartyYear({ year?, chamber? })` — nested `terms` agg on `speaker.party_group_at_time × year`.
- `getArchiveStats()` — homepage stats register; ten parallel `_count` calls (one per grain + a `is_substantive: true` filter on speeches) wrapped in `Promise.allSettled` so a partial outage doesn't blank the section.

Hard server-side guardrails baked into the layer (not client suggestions): `pageSize` clamped to 50, `isSubstantive: true` default on public-facing speech search (chair-procedure boilerplate hidden), aggregation `size` capped at 100, every search forces `track_total_hits: true` so paged totals stay stable across pages.

Per-call timing is logged via `timed(op, args, fn)`. In dev the wrapper writes a one-line `[search:OK|ERR]` to stderr; in prod (when `QUERY_LOG_WRITE=1`) the wrapper fire-and-forgets an `index` request to `monitorul_query_log`, swallowing failures. Each entry: `{ op, q, page, mode, took_ms, es_took_ms, hits_total, error, args, timestamp }`. `q` (trimmed user-facing search string), `page` (1-indexed), and `mode` (the _served_ retrieval — `rrf` or `bm25-only`, which can differ from the requested `rankFusion` after a silent degrade) are lifted out of `args` so Kibana / aggregations can group on them without nested-object parsing. All three are `null` for ops that don't expose them (getters, listings, person page).

## Hybrid search (RRF)

`searchSpeeches` defaults to `rankFusion: "rrf"` and fuses BM25 + kNN client-side. The query string is vectorised by [`src/lib/embed.ts`](../src/lib/embed.ts) which POSTs to the BGE-M3 FastAPI service from [`monitorul-ii`](https://github.com/ciocan/monitorul-ii) (`EMBED_URL`, e.g. `http://127.0.0.1:8000`). ES native `retrievers.rrf` is Platinum-licensed; we run on basic, so the layer issues two `_search` calls and fuses in JS with the same formula:

```
score(d) = Σ over legs of 1 / (RRF_RANK_CONSTANT + rank_in_leg)     # rank is 1-indexed
```

Constants in `search.ts` (kept in sync with `monitorul_ii.elasticsearch.queries`):

| Name                       | Value | Purpose                                                                         |
| -------------------------- | ----- | ------------------------------------------------------------------------------- |
| `RRF_RANK_CONSTANT`        | 60    | Standard RRF damping, per the 2009 paper                                        |
| `RRF_NUM_CANDIDATES_MULT`  | 10    | HNSW exploration depth multiplier on the kNN leg                                |
| `RRF_NUM_CANDIDATES_FLOOR` | 100   | Floor for `num_candidates` so small `pageSize` still gets meaningful neighbours |
| `RRF_POOL_FLOOR`           | 100   | Minimum pool size per leg                                                       |
| `RRF_POOL_CAP`             | 200   | Maximum pool size — past this, deep-paging falls back to BM25-only              |

Tiebreaker on equal RRF scores is `record_id` ascending — same as the Python sibling — so identical queries produce identical orderings across both code paths (cache-key stability and reproducible `(query, position)` analytics).

### Silent-degrade paths

RRF returns `mode: "bm25-only"` (instead of `"rrf"`) on the four conditions that make hybrid retrieval either impossible or actively misleading:

1. **Empty `q`** — no kNN target.
2. **Embed service unreachable** — `embedQuery` returns `null` on missing `EMBED_URL`, network error, non-200 response, or 10 s timeout.
3. **Deep pagination** — when `(page - 1) × pageSize ≥ RRF_POOL_CAP` (≈ page 11 at default page size), the fused pool can't span the requested offset; BM25 paginates natively from there.
4. **BM25 returns zero hits** — kNN is dropped. BGE-M3 produces a vector for any input, so kNN always returns its top-k — even for nonsense queries it surfaces ~100 weakly-related neighbours at similarity scores ~0.74 (vs ~0.79 for real semantic matches). BM25 acts as the relevance gate; queries with at least one BM25 anchor (e.g. typos like `"educatie"` matching `"educațiunii"`) still get the kNN expansion benefit.
5. **Explicit date sort** — `sort: "date-desc" | "date-asc"` forces a chronological order; fusing it with semantic rank is incoherent, so the dispatcher routes the request through the BM25-only path (which sorts natively via `bm25SortClause`).

The `/cauta` page surfaces the served mode as a `Hibrid` / `BM25` chip next to the took-ms timing.

### `SearchResult` shape

```ts
{
  hits: MoSpeech[]
  total: number             // see "Total semantics" below
  page, pageSize: number
  tookMs: number            // wall-clock; in RRF mode this is max(bm25.took, knn.took)
  highlights?: Record<record_id, snippet>   // BM25-leg highlights, with <mark>…</mark>
  mode?: "rrf" | "bm25-only"
}
```

### Diacritic-insensitive search

Romanian users frequently type without diacritics — `sosoaca` instead of `șoșoacă`, `iohanis` instead of `iohannis`. Every user-searchable text field on the `mo-*` indices carries a `.folded` subfield analyzed with `romanian_folded` (`standard` tokenizer + `lowercase` + `asciifolding` filters). The `bm25Leg` multi_match and the persons search both fan out across the main field plus its `.folded` sibling so either spelling matches the same documents.

Boost layout (in `SPEECH_SEARCH_FIELDS`):

| Field                        | Boost | Behaviour                                                |
| ---------------------------- | ----- | -------------------------------------------------------- |
| `text^2`                     | 2.0   | Diacritic-correct main field, `romanian` analyzer + stem |
| `text.folded^1`              | 1.0   | Folded subfield, matches no-diacritic queries            |
| `agenda_title^1.5`           | 1.5   | Agenda title, diacritic-correct                          |
| `agenda_title.folded^0.75`   | 0.75  | Agenda title, folded                                     |
| `speaker.name_search`        | 1.0   | Speaker name, diacritic-correct                          |
| `speaker.name_search.folded` | 1.0   | Speaker name, folded                                     |

The main field always boosts higher than its folded sibling so queries that include diacritics still rank exact matches first; queries that strip diacritics get the same hit set with slightly different ordering. This interacts cleanly with the BM25-zero-hits gate: pre-fix, a query like `sosoaca` returned 0 BM25 hits → kNN gate dropped → user saw nothing. Post-fix, `sosoaca` matches via `text.folded`, BM25 returns hits, kNN is fused in normally.

The highlight block opts into ES's `unified` highlighter with `matched_fields: ["text", "text.folded"]` so a snippet renders with `<mark>` markup whether the match landed on the main or folded field. Without `matched_fields`, snippets vanish on no-diacritic queries.

The vector leg is unaffected: BGE-M3 was trained on Romanian text in both diacritic-bearing and stripped forms; cosine similarity between `șoșoacă` and `sosoaca` query vectors is ~0.92–0.97. Indexed embeddings are over the corpus's diacritic-correct text and queries are passed verbatim to the embed service. Folding the query before embedding would push it off-distribution and hurt kNN recall — the folding fix is **lexical-side only**.

The mapping change (adding `.folded` subfields) ships from the [`monitorul-ii`](https://github.com/ciocan/monitorul-ii) indexer side. Operationally: `monitorul-ii es-init --update-mappings` pushes the additive subfields in seconds, then `monitorul-ii index pdfs/ --force` reanalyzes every doc to populate them (~15 min on the 5552-doc corpus at `-j 16`). This `search.ts` change is forward-compatible: indices that haven't been re-indexed yet have empty `.folded` subfields and the multi_match silently no-ops on them — the diacritic-correct main fields still serve diacritic-correct queries, only `sosoaca`-style queries return empty until the corpus is repopulated. Common-noun morphology (`educație` ↔ `educatie`) is intentionally not addressed by `romanian_folded` since the analyzer doesn't stem; deferred to a future `ro_folded` upgrade (folding + stemming + stopwords) if query-log signal warrants the additional generation rebuild.

### Divergences from the Python sibling

The core math is identical; the policy differs in four places, all deliberate:

| Concern              | Python (`monitorul-ii`)                               | This repo                                                                                           |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Default `rankFusion` | `"bm25-only"` (library, conservative)                 | `"rrf"` (web app — `EMBED_URL` is part of the env contract)                                         |
| RRF window depth     | `max(page × pageSize, 100)` — scales with page        | `max(pageSize × 5, 100)`, capped at 200, BM25-only past that — public-traffic cost ceiling          |
| BM25=0 → drop kNN    | not gated                                             | gated — suppresses kNN hallucination on gibberish public-input                                      |
| `total` semantics    | `bm25.total` (mode-stable across `bm25-only` ↔ `rrf`) | `max(bm25.total, fused.length)` (matches what's actually displayed when kNN saves a low-BM25 query) |

## Search filters (`/cauta`)

The page combines a single `q` input with a progressively-disclosed filter panel — a `<details>` element labelled `Filtre · N` (count of active filters), expanded automatically when at least one filter is set. v1 ships five filters and a sort:

| Filter        | URL param    | Backed by                                          | UI                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Years         | `year`       | `searchSpeeches.years` — `terms` on indexed `year` | **multi-select** chip row (last 5 years; each chip is a Radix `Checkbox`) + `Alt an` `<select>` that adds older years to the same set. URL: comma-separated, e.g. `?year=2024,2007`. Sorted ascending in URL for stable share-links.                                                                                                                                                                                                    |
| Date range    | `from`, `to` | `searchSpeeches.dateFrom` / `dateTo`               | not in v1 UI — reserved in URL contract for the v1.1 custom range picker                                                                                                                                                                                                                                                                                                                                                                |
| Chamber       | `chamber`    | `searchSpeeches.chamber`                           | shadcn `RadioGroup` rendered as chips (`Toate · Camera Deputaților · Senat`); slugged `cd` / `senat` in URL                                                                                                                                                                                                                                                                                                                             |
| Speaker       | `speaker`    | `searchSpeeches.speakerPersonId`                   | shadcn `command` + `popover` combobox (`<SpeakerCombobox>`), debounced `/api/search/persons`                                                                                                                                                                                                                                                                                                                                            |
| Party-at-time | `party`      | `dePartySlugs` → `searchSpeeches.speakerPartyRaw`  | shadcn `Select` with top-12 + `Alte` `<SelectGroup>`; values come from `listPartyEnumeration()` (1h memo). **Hidden when the enumeration is empty** — `speaker.party_group_at_time` is mapped on `mo-speeches` but unpopulated in the current corpus (upstream `monitorul-ii` hasn't shipped the per-speech party backfill yet). The filter materialises automatically once data lands; the URL contract reserves `?party=` regardless. |
| Procedural    | `procedural` | flips `searchSpeeches.isSubstantive` to `false`    | shadcn `Checkbox` `Include intervenții procedurale` (default off — substantive-only is the public default)                                                                                                                                                                                                                                                                                                                              |
| Sort          | `sort`       | `searchSpeeches.sort`                              | shadcn `RadioGroup` rendered as chips: `Relevanță · Data ↓ · Data ↑`; `relevance` is the default and stripped from the URL                                                                                                                                                                                                                                                                                                              |

The form is plain `<form action="/cauta" method="GET">` so it works without JS. [`<CautaFilterForm>`](../src/components/cauta/filter-form.tsx) is a thin `'use client'` wrapper that intercepts submission to (a) drop empty inputs, (b) collect every checked `year` checkbox and merge the `year-older` `<select>` into a single comma-joined `?year=` (sorted ascending for stable share-links), (c) `router.push` the resulting URL for soft navigation. Without JS, the browser submits the form as-is and the Zod parser splits the comma-separated year list back into a number array.

All Radix-stateful inputs (year `Checkbox`s, chamber/sort `RadioGroup`s, party `Select`, procedural `Checkbox`, `year-older` `<select>`) are keyed off URL-derived state (e.g. `key={`year-${y}-${checked}`}`). Soft navigation that changes the selection forces a remount; without the keys, Radix's client-side state would persist across the navigation and the next Aplică submission would re-emit the just-cleared values.

Search params are parsed by [`parseCautaSearchParams`](../src/lib/search-params.ts) into a typed `CautaSearchParams` shape. The same module owns `buildCautaHref(params, overrides?)` (used by pagination and the active-filter chip "remove" links) and `activeFilterCount(params)` (drives the `<summary>` badge). URL params are all-English and only "non-default" values ride in the URL — empty strings, `null` chamber, and `sort=relevance` are stripped to keep share-links terse.

Active filters render below the panel as a removable chip row ([`<ActiveFilters>`](../src/components/cauta/active-filters.tsx)). Each chip is a shadcn `Badge` (`variant=outline`, `asChild` wrapping a `<Link>`) to the same `/cauta?…` URL with that param cleared. Multi-year emits one chip per selected year — clicking removes only that year and leaves the rest of the selection intact. A final `Resetează filtrele` link clears every filter at once. No JS — chip removal is just navigation.

The combobox is the only client island in the panel. It's backed by [`/api/search/persons`](../src/app/api/search/persons/route.ts) which wraps `searchPersons()` and ships `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` — five-minute edge cache plus snappy stale revalidation for the typed-prefix loop. The combobox commits its selected slug to a hidden `<input name="speaker">` inside the form; clearing the selection writes an empty string, which the form-level strip drops on submit.

Per-grain pages (`/cauta/voturi`, `/cauta/interpelari`, `/cauta/comisii`) are deferred to v2.

## Person pages

`/politicieni/[slug]` is the citation-grade fiche for a single politician. The page calls `personPage(slug, year?)` (see [`src/lib/search.ts`](../src/lib/search.ts)) which composes:

- A direct `_id` lookup on `mo-persons` — the upstream pipeline mints `_id`, `id`, and `slug` to the same string (e.g. `ciolacu-marcel`), so URL slug = ES doc id.
- A **filtered** speech search (filters: `speaker.person_id`, `is_substantive: true`, plus the year/day range from search params), sorted by `session_date` desc → `position_in_document` asc. Drives the speeches list. Day-filtered views are exhaustive in one shot (up to 50 hits — a single sitting rarely produces more than ~30 substantive speeches by one speaker). Year / no-filter views paginate at 20 per page via `?page=N`, using the shared `<Pagination>` component (`src/components/pagination.tsx`); each link targets `#discursuri-recente` so the viewport snaps back to the speeches header on page change. `track_total_hits: true` powers both the "X discursuri" caption and `totalPages` math (`ceil(total / pageSize)`).
- An **unfiltered** career-long aggregation in parallel: `speech_count`, `first_speech_date`, `last_speech_date` (used as `MoPerson.stats` fallback), and a `by_year` `date_histogram` (`calendar_interval: year`, `min_doc_count: 1`) that powers the year sparkbar. Two queries instead of one because ES `global` + nested `filter` agg returned the per-year buckets filtered by the parent year filter despite the `global` escape — splitting is more reliable than fighting the bucket inheritance.
- A `date_histogram` (`calendar_interval: day`, `min_doc_count: 1`) over substantive speeches in the **selected calendar year** (Jan 1 – Dec 31). The selected year defaults to the most recent active year; an explicit `?year=YYYY` or `?day=YYYY-MM-DD` (year derived) swaps it. Calendar-year anchoring (rather than rolling 365 days) lets the sparkbar columns line up cleanly with the heatmap — clicking 2018 always shows the 2018 grid regardless of which day in 2018 the politician last spoke. Empty days are filled in by the renderer; ES only returns sparse buckets.

Layout: name + lifespan dateline → meta register (speeches / first / last / Wikidata) → mandates list → year sparkbar → contributions graph → recent speeches list (each row anchors back to `/mo/<year>/<part>/<issue>#discurs-<position_in_document>` so the citation lands on the exact speech). JSON-LD emits a `Person` node with `name`, `alternateName` (aliases), `birthDate`, `sameAs` (Wikidata URL when QID known).

The year sparkbar (see [`src/components/yearly-activity-chart.tsx`](../src/components/yearly-activity-chart.tsx)) is HTML/CSS, not SVG, so each column is a real `<Link>` with proper accessibility semantics (`aria-current="true"` on the selected year, descriptive `aria-label` per bar). Inactive years between the politician's first and last active year are gap-filled with zero-height bars so the time axis stays linear. Clicks use `scroll={false}` + `prefetch={false}` so the page swaps the heatmap below without snapping the viewport or eagerly fetching every year. `?year=` is non-canonical — `generateMetadata` always sets `alternates.canonical` to the bare URL so search engines consolidate any year-flavored crawl into one entry.

The contributions graph (see [`src/components/contributions-graph.tsx`](../src/components/contributions-graph.tsx)) is a pure-SVG signature component: 53-week × 7-day grid (Monday-first, ISO-8601), four-tier azure intensity scale (1 / 2–3 / 4–6 / 7+ speeches per day) on `paper-91` empty cells, native `<title>` tooltips for hover + screen-reader exposure. Non-empty cells are wrapped in plain `<a href>` (Next `<Link>` doesn't render inside SVG; the App Router still intercepts internal navigations) pointing at `?day=YYYY-MM-DD` — clicking narrows the speeches list below to that day and marks the cell with a 1.5px `ink-16` stroke. Empty cells are inert. Hidden when the politician has no recorded `last_speech_date`; renders an all-empty grid when `?year=` lands on a year with no activity.

The speeches section header swaps based on filter state: `Discursuri recente` (no filter), `Discursuri din 2018` (year), `Discursuri din 15 martie 2018` (day). When the filter total exceeds the page size, a "10 din 82" caption appears next to the header. The empty state copy follows the same axis: a generic linking-pass note when no filter is applied, a precise "Nu există discursuri înregistrate la …" / "în …" when the filter scope happens to be empty.

Each row also surfaces a word count + 5-segment length meter (xs <30, s 30–99, m 100–299, l 300–799, xl 800+ words) so the list is scannable for at-a-glance speech weight. The count uses the same Markdown-strip pass as `speechExcerpt` (so `**Domnul X:**`, `## section`, italics don't inflate it) and is computed client-side in the Server Component from `speech.text`, which is already in the `personPage` `_source` for the excerpt — adding the meter incurs zero additional ES cost. The indexed `text_length` is a character count (`is_substantive` thresholds at `≥ 100` chars), not a word count, so it can't be reused directly. The meter component (`src/components/speech-length-meter.tsx`) is shared with the `/cauta` hit rows, where the same client-side derivation runs against `MoSpeech.text` already returned by `searchSpeeches` (BM25-only and RRF page-slice fetches both keep `text` in `_source`), so the search page also pays no extra ES cost.

**Speaker→person link gate.** Speech blocks on the document page wrap the speaker name in a `<Link>` only when `speaker.person_id` is non-null. The upstream linking pass (`monitorul-ii backfill --kind=persons` + `monitorul-ii index --force --grain=mo-speeches`) is what populates that field — running on the corpus right now. While it's mid-pass, most speakers render as plain text and the URL is unreachable; as soon as a speech is linked, the same render path produces a working link with no frontend revisit. `/politicieni/<slug>` itself is reachable for any person record (13K+ today), independent of the linking pass.

## Committee pages

`/comisii` and `/comisii/[committee_id]` together form the committee registry. Both pages are derived live from `mo-committee-meetings` because **there is no `mo-committees` index upstream** — committees only exist in the public record as the headers on indexed meetings. A committee with zero indexed meetings is therefore invisible to the registry; this is intentional, since this site is the read surface over the published archive.

`committeesIndex({ year? })` (the index payload) runs three queries:

- A `date_histogram` over `meeting_date` (`calendar_interval: year`, `min_doc_count: 1`) for the per-year sparkbar — same shape as the politicians sparkbar, but counted in meetings rather than speeches.
- A `terms` aggregation on `committee_id` (size 100, ordered by `_count: desc`) over the year-filtered meeting set, with sub-aggregations for `min`/`max` `meeting_date` and a `top_hits` (size 1, sorted by `meeting_date: desc`) that surfaces the most recent spelling of `committee_name` / `committee_kind` / `joint_with` — the upstream pipeline keeps these consistent across re-extractions but not strictly invariant, so the latest meeting is treated as the canonical source. A sibling `cardinality` agg on `committee_id` returns the in-scope committee count.
- A separate `cardinality` over `committee_id` against the unfiltered index for the registry-wide total surfaced in the dateline.

`committeePage(committee_id, { year? })` (the profile payload) runs at most two queries: one composite aggregation with a `top_hits` sample for the header, `min`/`max` meeting dates, and the per-year `date_histogram` for this committee's sparkbar; then if the committee has any meetings, a follow-up `_search` returns the meeting list for the selected year (sorted by `meeting_date: desc`, capped at `MAX_PAGE_SIZE = 50`). When `track_total_hits` reports zero meetings, the function returns `null` so the page calls `notFound()` rather than rendering an empty fiche.

Layout: dateline (`Registrul comisiilor` · kind label · `comună` if `joint_with` is non-empty · year span) → name + joint-with paragraph → meta register (`Ședințe` / `Prima ședință` / `Ultima ședință` / `Identificator`) → year sparkbar → meeting list. Each meeting row shows: `meeting_date` (mono), optional `purpose` chip, the first non-empty `agenda_items[].title` as the one-liner, then a meta strip (`format`, attendance ratio computed client-side from `roster[].status === "present"`, agenda-item count) and a footer of outcome counts (`agenda_outcomeLabel(o): N`, sorted by count desc). JSON-LD emits a `GovernmentOrganization` node with `identifier: committee_id`, `foundingDate: firstMeetingDate`, and a `description` derived from `committeeKindLabel(kind)`.

The kind chip uses `committeeKindLabel` in [`src/lib/format.ts`](../src/lib/format.ts), which maps the upstream enum (`permanent` / `special` / `joint` / `inquiry` / `mediation`, plus their Romanian-spelled variants) to the corresponding Romanian label. Unknown values pass through with underscores swapped for spaces so a new upstream kind is rendered legibly without a code change.

`?year=` is non-canonical on both pages — `generateMetadata` always sets `alternates.canonical` to the bare URL (`/comisii` or `/comisii/<committee_id>`), matching the convention on `/mo` and `/politicieni`. ISR is 1 hour. The 50-meeting cap on the profile page is currently unsourced for committees with denser schedules; an explicit pagination layer will land alongside the rest of the per-grain detail routes.

## Methodology page (`/despre`)

`/despre` is the long-form note that explains what monitorul.ai is, where the data comes from, why links stay stable, how search works, and where to flag errors. It is a static editorial surface — no Elasticsearch reads, no derived stats — so the route is plain server JSX with `revalidate = 3600` to match the rest of the site.

**Two-part structure.** The page is split deliberately, not just chunked. Most readers (citizens, journalists, students, NGO researchers without a tech background) need a plain-language overview, no jargon. A smaller cohort (data journalists, civic-tech researchers, devs using the archive as a reproducible source) needs the depth — pipeline steps, identity guarantees, search internals. Stuffing both audiences into one continuous narrative either patronises the second cohort or alienates the first; splitting visually-and-anchorably resolves that.

| Part                          | Audience                                | Anchors                                                                                |
| ----------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| **I — Pentru toți cititorii** | citizens / journalists / casual readers | `#ce-este`, `#de-unde`, `#acoperire`, `#identitate`, `#cautare`, `#corectii`, `#sursa` |
| **II — Detalii tehnice**      | data journalists / researchers / devs   | `#pipeline`, `#identitate-tehnic`, `#cautare-tehnic`                                   |

**What lives where.**

- Part I `#ce-este` — one-paragraph mission + the disclaimer that this is not the official source.
- Part I `#de-unde` — high-level "where the data comes from" framing (programul descarcă PDF-uri, citește, nu adaugă, nu interpretează). Cross-links down to `#pipeline` for the technical reader.
- Part I `#acoperire` — scope (Partea II only), the low-coverage cohort caveat, the partial-completeness state of the politician registry, the indexing window.
- Part I `#identitate` — plain-language "stable links as a design contract" framing, with a cross-link down to `#identitate-tehnic` for the mechanism.
- Part I `#cautare` — plain "exact words + similar meaning" framing, the `Hibrid` / `BM25` chip explained, with a cross-link down to `#cautare-tehnic` for BM25/kNN/RRF.
- Part I `#corectii` — four plain-Romanian error categories (atribuire greșită / tăiere greșită / referințe nelegate / acoperire incompletă) + the "open an issue" CTA + redaction note.
- Part I `#sursa` — source attribution (monitoruloficial.ro, cdep.ro, senat.ro), the Partea I vs Partea II boundary, and links to both code repos.
- Part II `#pipeline` — the 8-step register (fetch / convert / classify / extract / link / backfill / embed / index) with the "ES is a derivation, sidecars on disk are SOT" note.
- Part II `#identitate-tehnic` — `record_id` shape per grain, the `content_fingerprint` forensic key, the `slug-once` URL contract, and the cross-consumer keying argument.
- Part II `#cautare-tehnic` — BM25 + kNN/RRF, the `.folded` subfields, the silent-degrade gates (empty query, embed unavailable, deep pagination, zero BM25 hits), and the native-RRF licensing note.

**Footer URL contract.** The site footer's Metodologie column links to `#identitate` and `#corectii`. Both live in Part I, so a non-technical reader following the footer lands on the plain-language version first. Inside Part I, both sections carry an inline cross-link down to their Part II counterpart for readers who want depth.

**Heading outline.** `<h1>` is the page title. Both parts open with an `<h2>` (Part header). Sections inside each part use `<h3>`, so the document outline reflects the two-part nesting rather than reading as a flat 11-section list. The `Cuprins` is rendered as two side-by-side columns (one per part) so the page structure is visible from the top.

JSON-LD emits an `AboutPage` node with `isPartOf` pointing at the WebSite entity. The page sets `alternates.canonical = "/despre"` and stays indexable. No external dependencies — the only imports are `next/link`, the `Dateline` signature component, and the validated `env` for the JSON-LD `@id` URL.

## Document page playback

`/mo/[year]/[part]/[issue]` renders two stacked sections:

1. **Cuprins (TOC)** — one row per agenda item with category / outcome / cited-bills metadata. Until the dedicated `/agenda/<ord>` route ships, each row links to an in-page anchor (`#agenda-<ord>`). When the document has no agenda items (typical for `committee_synthesis` issues), the section shows a quiet inline note instead of an `Empty` block.
2. **Stenograma / Ședințe (body)** — for each agenda item (in `position_in_document` ASC), a section header + an ordered list of every child record under it: speeches (full text, paragraph-split on blank lines, addressable as `#discurs-<position_in_document>`), votes (outcome + counts), interpellations (questioner / topic / question text), questions (regnum / questioner / topic), and committee meetings (date, linked committee name, kind / joint-with chips, agenda items list, attendance ratio, outcome counts; addressable as `#comisie-<position_in_document>`). Children that arrive before the first agenda boundary fall into an unlabelled leading section. The heading switches from "Stenograma" to "Ședințe" when the document has no agenda items but does have committee meetings — `committee_synthesis` issues, where the body IS the meeting register.

`listDocumentChildren` fans out across six per-doc child indices (`mo-agenda-items`, `mo-speeches`, `mo-votes`, `mo-interpellations`, `mo-questions`, `mo-committee-meetings`) in a single multi-index search and re-classifies each hit by `_index` prefix on the way back. Sort is `position_in_document` ASC across grains, so meetings interleave with the rest of the body in source order. The 500-row size cap is sized for the biggest plenary sittings; committee-synthesis issues run under 30 meetings and the largest plenary stenograms ship ~100 speeches plus their satellites.

The page does not filter on `is_substantive` — the whole stenographic record is shown, including procedural turns, because this is the archive surface, not the search surface.

## Speech detail page

`/discurs/[slug]` is the canonical citation URL for a single speech, in the shape minted upstream as `/discurs/<title-keywords>-<short_id>` (slug-once, persisted at `extraction.identity.slug` in the sidecar — see `../monitorul/docs/elasticsearch-indexing.md` §Q7). One ES round-trip via [`getSpeechBySlug`](../src/lib/search.ts) drives the page; no parallel fans, no parent-doc fetch (every metadata field needed for the dateline / agenda strip / back-link is denormalised onto the speech grain).

Layout: dateline ("Monitorul Oficial · Partea II · chamber · session date") → header (agenda category + outcome eyebrow → speaker as `font-display` H1, linked to `/politicieni/<person_id>` when the upstream linker has populated it → role / party-at-time / delivery mode strip → agenda title linked back to `#agenda-<ord>` on the parent doc → word count + 5-segment `<SpeechLengthMeter>`, plus an "Intervenție procedurală" tag when `is_substantive: false`) → body (full text, paragraph-split on blank lines like the inline document-page rendering) → optional refs strip (`speech.refs.bills` listed in mono) → "În contextul ședinței →" link to `/mo/<year>/<part>/<issue>#discurs-<position_in_document>` → record identity footer (`record_id`, `content_fingerprint`, `schema_version`, `indexed_at`).

**Slug-once redirects.** When the requested slug is not the canonical one persisted on the record, the page issues `permanentRedirect(speech.url_path)` (308). The `getSpeechBySlug` fallback path is what makes this possible: a leading-`*` `wildcard` on `slug` matched against the trailing base32 short-id tail (`*-<short_id>`), capped with `terminate_after: 1` so the scan bails at the first hit. The fallback is rare (slugs are persisted slug-once upstream), but the upstream contract reserves it for the case where v0.x of the extractor reshuffles the title-keyword prefix. Direct hits to a non-canonical slug 308 to canonical so Google collapses the variants into a single ranking signal.

**Indexability.** Substantive speeches (`is_substantive: true`) emit `index, follow` and are citation-grade; procedural turns drop to `noindex, follow` so they remain reachable for inbound deep-links but don't dilute domain ranking signal across the ~282K thin-content turns the corpus carries.

JSON-LD emits a `Quotation` node (`text`, `datePublished`, `inLanguage: "ro"`, `creator: Person`, `url`) with `isPartOf` pointing at the parent `Article` (the document page). When `speaker.person_id` is non-null, the `Person` node carries `@id` + `url` referencing the politician page. The graph is rendered as a single `<script type="application/ld+json">` per the same pattern as the document page.

The page is reached from three places today: a future search-hit headline link on `/cauta` (currently the search-hit layout still routes to the document anchor — flipping the headline target to `/discurs/<slug>` is a follow-up), the recent-speeches list on `/politicieni/<slug>`, and direct citation. The speech URL never replaces the in-document anchor (`#discurs-<position_in_document>`); both addresses coexist — the slug URL is the durable citation, the anchor is the in-context reading position.

## Original PDFs

The website surfaces a "Vezi PDF original" link on every document page that points at the original Monitorul Oficial PDF — the same bytes scraped upstream by `monitorul-ii fetch`. The bytes live in a **private** Cloudflare R2 bucket (S3-compatible). The bucket is never publicly readable; the website mediates every download.

### Bucket key shape

Upstream, `monitorul-ii`'s scraper (`scraper.py`, `Issue.filename`) names every PDF as:

```
{published_iso}_MO-P{part}-{issue}-{year}.pdf
```

Example: `2026-02-13_MO-PII-9c-2026.pdf`. We re-derive the key on every request from the indexed `MoDocument` rather than trusting the `s3_url_pdf` field in ES (which the upstream indexer leaves `null` today). The two will agree if the field is later populated; trusting the derivation also future-proofs against rename schemes.

The derivation lives in [`src/lib/pdf.ts`](../src/lib/pdf.ts) (`pdfKeyForDocument`). It returns `null` when the document has no `published` date — the rare facsimile rows where the upstream pipeline couldn't pin a publication date. The link is hidden in those cases.

### Presigned-URL redirect (no bucket exposure)

The app **does not** stream PDF bytes through Next.js (Vercel egress would be wasteful for an archive serving multi-MB PDFs at long-tail rates). Instead:

1. The user clicks "Vezi PDF original" → browser hits `/mo/[year]/[part]/[issue]/pdf`.
2. The route handler ([`src/app/mo/[year]/[part]/[issue]/pdf/route.ts`](../src/app/mo/%5Byear%5D/%5Bpart%5D/%5Bissue%5D/pdf/route.ts), `force-dynamic`) resolves the document, derives the bucket key, and asks `presignPdfUrl()` for a SigV4-presigned GET URL valid for 5 minutes.
3. The handler returns `302 Found` with `Location: <signed url>`. The browser follows the redirect and fetches the PDF directly from R2.

The signing keys (`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`) are server-only env vars; they never reach the browser. The R2 hostname (`*.r2.cloudflarestorage.com`) IS visible in the address bar after the redirect — that's an inherent property of presigned URLs. Hiding the hostname requires either a Cloudflare Worker on a custom domain (`archive.monitorul.ai` → bucket; the Worker validates the request and re-signs), or full-byte proxying through Next.js. We've chosen the redirect because it costs nothing in egress and the hostname leak is uninteresting (the bucket itself is unenumerable without creds).

### SigV4 with `aws4fetch` (not the AWS SDK)

[`aws4fetch`](https://github.com/mhart/aws4fetch) is a ~6KB edge-compatible SigV4 client. We use it instead of `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` because:

- The AWS SDK adds ~250KB+ to the serverless cold start.
- We only need one operation (presigned GET) — the full SDK is overkill.
- `aws4fetch` runs unchanged on the Vercel Edge runtime if we ever move the route there (today the route is the default Node runtime).

The signing call:

```ts
const url = new URL(`/${env.S3_BUCKET}/${encodeURIComponent(key)}`, env.S3_ENDPOINT);
url.searchParams.set("X-Amz-Expires", "300");
const signed = await aws.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
return signed.url;
```

`signQuery: true` puts the signature in query parameters (presigned URL form) rather than in `Authorization` headers — the only form a browser following a 302 can use.

### TTL and caching

5 minutes (`X-Amz-Expires=300`) is long enough for the browser to follow the redirect and start the download, short enough that a leaked URL is useless within minutes. The route handler is `force-dynamic` — every request mints a fresh signature. Caching the redirect would also cache the (expiring) URL, which is the wrong trade. SigV4 signing is microseconds; the cost is negligible.

### Configuration and degradation

All four `S3_*` env vars are optional. When any of `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` is missing:

- `isPdfBucketConfigured()` returns `false`.
- The document page hides the PDF link entirely.
- The route handler returns `503 Service Unavailable` if hit directly.

This lets search-only deploys (or CI) run without storage creds. `S3_REGION` defaults to `auto` (Cloudflare's recommendation; R2 ignores it but SigV4 requires _something_ in the string-to-sign).

## Caching and ISR invalidation

- Detail pages → `force-static` with `revalidate: 3600` and `revalidateTag('mo-<grain>:<id>')`.
- Search results → `Cache-Control: s-maxage=60, stale-while-revalidate=300`.
- Sitemaps → `revalidate = 3600` per shard. [`src/app/sitemap.ts`](../src/app/sitemap.ts) exports `generateSitemaps()` returning `{ id: string }[]` — descriptive ids (`static`, `persons`, `committees`, `docs-YYYY`) keep `/sitemap/<id>.xml` URLs bookmark-stable. Lean scope: every static page + politician + committee + document, but no speech URLs (those flow through internal links). `mo-persons` and `mo-documents` are read with `search_after` over `_doc` sort, 5k-per-batch up to 50k per shard. Next.js 16 doesn't auto-emit a `<sitemapindex>` and adding a handler at `/sitemap.xml` conflicts with the metadata loader's URL namespace, so [`src/app/robots.ts`](../src/app/robots.ts) advertises every shard as its own `Sitemap:` line — fully sitemap-protocol-compliant and what Googlebot/Bingbot consume directly. Design record: [`_session-handoff-2026-05-10-sitemap.md`](./_session-handoff-2026-05-10-sitemap.md).

The Python indexer (`monitorul-ii index`) calls a webhook on every successful upsert with the affected `(grain, record_id)` pairs. This app exposes the receiving route, validates the shared secret, and calls `revalidateTag` for each pair so freshly-indexed records appear without a full rebuild.

## Credentials

Two API keys are minted by `monitorul-ii es-init`. **This app uses only `monitorul_reader`** — read-only on `mo-*`, no scripting, no scroll, no `_sql`, no cluster info. The `monitorul_indexer` key never leaves the Python pipeline.

## MCP server

A public, OAuth-authenticated Model Context Protocol server is mounted on the same Next.js app, with two URLs:

- **`/mcp`** — human-facing presentation page (`src/app/mcp/page.tsx`). Editorial-archival aesthetic; copy in Romanian; lists the 16 tools, sample queries, and copy-pasteable client configs (Claude Desktop, Cursor, Codex). ISR 1h, JSON-LD `WebAPI`.
- **`/mcp/server`** — streamable-HTTP endpoint that AI clients connect to. Lives at `src/app/mcp/server/route.ts`; the handler passes `streamableHttpEndpoint: "/mcp/server"` to `mcp-handler` so the dispatcher's pathname-comparison agrees with the file location. No rewrite — `mcp-handler` reads `req.url` (which preserves the source path under a rewrite), so attempting to rewrite from a clean URL silently breaks the dispatch.

The handler registers 16 Zod-typed tools — every tool is a thin wrapper over a function in `src/lib/search.ts`, so there's no protocol drift between the web pages and the MCP. The full design contract (build phases, tool inventory, hit shape, rate-limit tiers, deferred V2 features) lives in [`docs/mcp.md`](./mcp.md).

Notable shape decisions:

- **Cataloguer-mode hit shape** ([`src/lib/mcp-adapters.ts`](../src/lib/mcp-adapters.ts)) — search-shape tools (`search_speeches`, `search_persons`) trim each hit to `{ record_id, url_path, absolute_url, speaker, date, chamber, agenda_title, excerpt (240ch), refs }`. Bodies stay behind `get_speech(record_id)` so multi-step LLM calls fit the context window.
- **Streamable HTTP only** — SSE is disabled (`disableSse: true`). Modern MCP clients (Claude Desktop, Cursor, Cline, claude.ai) negotiate streamable HTTP first; legacy SSE would require a Redis session-state side-channel for no benefit.
- **Live chamber enumeration** — `describe_corpus` aggregates distinct `chamber` values from `mo-speeches` rather than returning the `Chamber` TS union. The corpus stores `"Senatul"` (with definite article) but the type says `"Senat"`; surfacing live values is the only way the LLM gets a filter that round-trips non-zero.
- **Rate limits** ([`src/lib/ratelimit.ts`](../src/lib/ratelimit.ts)) — Upstash sliding window across two axes (per-IP, per-user). 30/min general + 20/min heavy on each axis; both must clear. The wrapper sniffs the JSON-RPC body to identify heavy calls without disturbing the downstream handler. No-op when Upstash creds aren't set (dev only — production sets both).
- **Auth: OAuth 2.0 + DCR + PKCE via Better Auth's `mcp` plugin** ([`src/lib/auth.ts`](../src/lib/auth.ts)). Single Google social provider for sign-in; `withMcpAuth(auth, …)` wraps the route handler — every request to `/mcp/server` carries a bearer token whose `userId` reaches the rate-limiters and the query log. Discovery routes at `/.well-known/oauth-{authorization-server,protected-resource}` are public per RFC 9728. The full handshake + UI surfaces (`/cont`, `/cont/intra`, `/cont/consimt`) are documented in [`docs/mcp.md`](./mcp.md).

## Auth + per-user attribution

Authentication is implemented by Better Auth's [`mcp` plugin](https://better-auth.com/docs/plugins/mcp), backed by Neon Postgres via the Drizzle adapter. The runtime client lives in [`src/lib/db/client.ts`](../src/lib/db/client.ts) (pooler URL, `max: 1`); migrations run from the laptop against `DATABASE_DIRECT_URL` via `bun --env-file=.env.local --bun drizzle-kit migrate`. Schema is generated by `bunx better-auth generate`; the generated file is committed at [`src/lib/db/schema.ts`](../src/lib/db/schema.ts).

Per-call attribution is stamped on every `mo_query_log` row via `user_id`. The MCP route extracts `session.userId` from the Better Auth session inside `withMcpAuth`, then runs the handler inside `requestContext.run({ userId, surface: "mcp", tool, … }, …)`; downstream `logQuery` reads it from the AsyncLocalStorage scope. Anonymous web traffic (RSC pages, `/api/search/persons` autocomplete) leaves `user_id: null`. See [`docs/mcp.md`](./mcp.md) for the full OAuth flow, discovery routes, and revocation semantics.
