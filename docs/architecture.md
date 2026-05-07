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

- `searchSpeeches({ q, speakerPersonId, chamber, dateFrom, dateTo, refBills, topics, isSubstantive, page, pageSize, rankFusion })` — multi_match BM25 over the `SPEECH_SEARCH_FIELDS` constant (main fields `text^2` / `agenda_title^1.5` / `speaker.name_search` paired with their `.folded` subfields at lower boosts so no-diacritic queries like `sosoaca` still match indexed `șoșoacă` — see "Diacritic-insensitive search" below), fused with kNN over `enrichments.embedding` via RRF (default — see below).
- `searchSpeechesKnn` — pure kNN ablation; throws (no BM25 fallback) when the embed service is unreachable so callers can distinguish misconfig from "no semantic matches".
- `listDocumentChildren(documentId)` — multi-grain interleave for `/mo/<id>` playback, sorted by `position_in_document` ASC. Speech `text` is **kept** in the response (only `enrichments.embedding` is excluded) so the document page can render speech bodies inline; with ~50 speeches per stenogram and ISR 1h, the per-page payload is acceptable.
- `getDocument` / `getAgendaItem` / `getSpeech` / `getReport` — single lookup by `record_id`.
- `listDocumentsByDate(date, chamber?)` / `listCommitteeMeetings(committeeId, dateFrom?)`
- `personPage(slug, { year?, day? })` — composite payload for `/politicieni/<slug>`. Two ES queries run in parallel: a **filtered** speech search narrowed to `year` or `day` (drives the speeches list, returns up to 50 hits for a day filter, 10 otherwise), and an **unfiltered** career-long aggregation (drives the year sparkbar + stats fallback). `day` implies year (parsed from the date string); a separate per-day `date_histogram` runs sequentially after for the heatmap of the selected calendar year.
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

## Person pages

`/politicieni/[slug]` is the citation-grade fiche for a single politician. The page calls `personPage(slug, year?)` (see [`src/lib/search.ts`](../src/lib/search.ts)) which composes:

- A direct `_id` lookup on `mo-persons` — the upstream pipeline mints `_id`, `id`, and `slug` to the same string (e.g. `ciolacu-marcel`), so URL slug = ES doc id.
- A **filtered** speech search (filters: `speaker.person_id`, `is_substantive: true`, plus the year/day range from search params), sorted by `session_date` desc → `position_in_document` asc. Drives the speeches list. Returns up to 50 hits for a day filter (a single sitting rarely produces more than ~30 substantive speeches by one speaker), 10 otherwise. `track_total_hits: true` so the section can show "10 din 82".
- An **unfiltered** career-long aggregation in parallel: `speech_count`, `first_speech_date`, `last_speech_date` (used as `MoPerson.stats` fallback), and a `by_year` `date_histogram` (`calendar_interval: year`, `min_doc_count: 1`) that powers the year sparkbar. Two queries instead of one because ES `global` + nested `filter` agg returned the per-year buckets filtered by the parent year filter despite the `global` escape — splitting is more reliable than fighting the bucket inheritance.
- A `date_histogram` (`calendar_interval: day`, `min_doc_count: 1`) over substantive speeches in the **selected calendar year** (Jan 1 – Dec 31). The selected year defaults to the most recent active year; an explicit `?year=YYYY` or `?day=YYYY-MM-DD` (year derived) swaps it. Calendar-year anchoring (rather than rolling 365 days) lets the sparkbar columns line up cleanly with the heatmap — clicking 2018 always shows the 2018 grid regardless of which day in 2018 the politician last spoke. Empty days are filled in by the renderer; ES only returns sparse buckets.

Layout: name + lifespan dateline → meta register (speeches / first / last / Wikidata) → mandates list → year sparkbar → contributions graph → recent speeches list (each row anchors back to `/mo/<year>/<part>/<issue>#discurs-<position_in_document>` so the citation lands on the exact speech). JSON-LD emits a `Person` node with `name`, `alternateName` (aliases), `birthDate`, `sameAs` (Wikidata URL when QID known).

The year sparkbar (see [`src/components/yearly-activity-chart.tsx`](../src/components/yearly-activity-chart.tsx)) is HTML/CSS, not SVG, so each column is a real `<Link>` with proper accessibility semantics (`aria-current="true"` on the selected year, descriptive `aria-label` per bar). Inactive years between the politician's first and last active year are gap-filled with zero-height bars so the time axis stays linear. Clicks use `scroll={false}` + `prefetch={false}` so the page swaps the heatmap below without snapping the viewport or eagerly fetching every year. `?year=` is non-canonical — `generateMetadata` always sets `alternates.canonical` to the bare URL so search engines consolidate any year-flavored crawl into one entry.

The contributions graph (see [`src/components/contributions-graph.tsx`](../src/components/contributions-graph.tsx)) is a pure-SVG signature component: 53-week × 7-day grid (Monday-first, ISO-8601), four-tier azure intensity scale (1 / 2–3 / 4–6 / 7+ speeches per day) on `paper-91` empty cells, native `<title>` tooltips for hover + screen-reader exposure. Non-empty cells are wrapped in plain `<a href>` (Next `<Link>` doesn't render inside SVG; the App Router still intercepts internal navigations) pointing at `?day=YYYY-MM-DD` — clicking narrows the speeches list below to that day and marks the cell with a 1.5px `ink-16` stroke. Empty cells are inert. Hidden when the politician has no recorded `last_speech_date`; renders an all-empty grid when `?year=` lands on a year with no activity.

The speeches section header swaps based on filter state: `Discursuri recente` (no filter), `Discursuri din 2018` (year), `Discursuri din 15 martie 2018` (day). When the filter total exceeds the page size, a "10 din 82" caption appears next to the header. The empty state copy follows the same axis: a generic linking-pass note when no filter is applied, a precise "Nu există discursuri înregistrate la …" / "în …" when the filter scope happens to be empty.

**Speaker→person link gate.** Speech blocks on the document page wrap the speaker name in a `<Link>` only when `speaker.person_id` is non-null. The upstream linking pass (`monitorul-ii backfill --kind=persons` + `monitorul-ii index --force --grain=mo-speeches`) is what populates that field — running on the corpus right now. While it's mid-pass, most speakers render as plain text and the URL is unreachable; as soon as a speech is linked, the same render path produces a working link with no frontend revisit. `/politicieni/<slug>` itself is reachable for any person record (13K+ today), independent of the linking pass.

## Document page playback

`/mo/[year]/[part]/[issue]` renders two stacked sections:

1. **Cuprins (TOC)** — one row per agenda item with category / outcome / cited-bills metadata. Until the dedicated `/agenda/<ord>` route ships, each row links to an in-page anchor (`#agenda-<ord>`).
2. **Stenograma (body)** — for each agenda item (in `position_in_document` ASC), a section header + an ordered list of every child record under it: speeches (full text, paragraph-split on blank lines, addressable as `#discurs-<position_in_document>`), votes (outcome + counts), interpellations (questioner / topic / question text), and questions (regnum / questioner / topic). Children that arrive before the first agenda boundary fall into an unlabelled leading section.

The page does not filter on `is_substantive` — the whole stenographic record is shown, including procedural turns, because this is the archive surface, not the search surface.

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
- Sitemaps → `force-static`, regenerated nightly.

The Python indexer (`monitorul-ii index`) calls a webhook on every successful upsert with the affected `(grain, record_id)` pairs. This app exposes the receiving route, validates the shared secret, and calls `revalidateTag` for each pair so freshly-indexed records appear without a full rebuild.

## Credentials

Two API keys are minted by `monitorul-ii es-init`. **This app uses only `monitorul_reader`** — read-only on `mo-*`, no scripting, no scroll, no `_sql`, no cluster info. The `monitorul_indexer` key never leaves the Python pipeline.
