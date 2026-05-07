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

- `searchSpeeches({ q, speakerPersonId, chamber, dateFrom, dateTo, refBills, topics, isSubstantive, page, pageSize, rankFusion })` — multi_match BM25 over `text^2` / `agenda_title^1.5` / `speaker.name_search`, fused with kNN over `enrichments.embedding` via RRF (default — see below).
- `searchSpeechesKnn` — pure kNN ablation; throws (no BM25 fallback) when the embed service is unreachable so callers can distinguish misconfig from "no semantic matches".
- `listDocumentChildren(documentId)` — multi-grain interleave for `/mo/<id>` playback, sorted by `position_in_document` ASC. Speech `text` is **kept** in the response (only `enrichments.embedding` is excluded) so the document page can render speech bodies inline; with ~50 speeches per stenogram and ISR 1h, the per-page payload is acceptable.
- `getDocument` / `getAgendaItem` / `getSpeech` / `getReport` — single lookup by `record_id`.
- `listDocumentsByDate(date, chamber?)` / `listCommitteeMeetings(committeeId, dateFrom?)`
- `personPage(slug)` — composite payload for `/politicieni/<slug>`: person record + recent substantive speeches + speech-count / first-/last-speech-date aggregations.
- `searchPersons(q)` — `multi_match` with `operator: and` over `canonical_name` (+ `.folded` subfield) and `aliases`.
- `aggSpeechesByPartyYear({ year?, chamber? })` — nested `terms` agg on `speaker.party_group_at_time × year`.
- `getArchiveStats()` — homepage stats register; ten parallel `_count` calls (one per grain + a `is_substantive: true` filter on speeches) wrapped in `Promise.allSettled` so a partial outage doesn't blank the section.

Hard server-side guardrails baked into the layer (not client suggestions): `pageSize` clamped to 50, `isSubstantive: true` default on public-facing speech search (chair-procedure boilerplate hidden), aggregation `size` capped at 100, every search forces `track_total_hits: true` so paged totals stay stable across pages.

Per-call timing is logged via `timed(op, args, fn)`. In dev the wrapper writes a one-line `[search:OK|ERR]` to stderr; in prod (when `QUERY_LOG_WRITE=1`) the wrapper fire-and-forgets an `index` request to `monitorul_query_log`, swallowing failures.

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

### Divergences from the Python sibling

The core math is identical; the policy differs in four places, all deliberate:

| Concern              | Python (`monitorul-ii`)                               | This repo                                                                                           |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Default `rankFusion` | `"bm25-only"` (library, conservative)                 | `"rrf"` (web app — `EMBED_URL` is part of the env contract)                                         |
| RRF window depth     | `max(page × pageSize, 100)` — scales with page        | `max(pageSize × 5, 100)`, capped at 200, BM25-only past that — public-traffic cost ceiling          |
| BM25=0 → drop kNN    | not gated                                             | gated — suppresses kNN hallucination on gibberish public-input                                      |
| `total` semantics    | `bm25.total` (mode-stable across `bm25-only` ↔ `rrf`) | `max(bm25.total, fused.length)` (matches what's actually displayed when kNN saves a low-BM25 query) |

## Person pages

`/politicieni/[slug]` is the citation-grade fiche for a single politician. The page calls `personPage(slug)` (see [`src/lib/search.ts`](../src/lib/search.ts)) which composes:

- A direct `_id` lookup on `mo-persons` — the upstream pipeline mints `_id`, `id`, and `slug` to the same string (e.g. `ciolacu-marcel`), so URL slug = ES doc id.
- A 10-row recent-speeches list filtered by `speaker.person_id` and `is_substantive: true`, sorted by `session_date` desc.
- Aggregations for `speech_count`, `first_speech_date`, `last_speech_date` (used as fallback when the upstream `MoPerson.stats` block is missing).

Layout: name + lifespan dateline → meta register (speeches / first / last / Wikidata) → mandates list → recent speeches list (each row anchors back to `/mo/<year>/<part>/<issue>#discurs-<position_in_document>` so the citation lands on the exact speech). JSON-LD emits a `Person` node with `name`, `alternateName` (aliases), `birthDate`, `sameAs` (Wikidata URL when QID known).

**Speaker→person link gate.** Speech blocks on the document page wrap the speaker name in a `<Link>` only when `speaker.person_id` is non-null. The upstream linking pass (`monitorul-ii backfill --kind=persons` + `monitorul-ii index --force --grain=mo-speeches`) is what populates that field — running on the corpus right now. While it's mid-pass, most speakers render as plain text and the URL is unreachable; as soon as a speech is linked, the same render path produces a working link with no frontend revisit. `/politicieni/<slug>` itself is reachable for any person record (13K+ today), independent of the linking pass.

## Document page playback

`/mo/[year]/[part]/[issue]` renders two stacked sections:

1. **Cuprins (TOC)** — one row per agenda item with category / outcome / cited-bills metadata. Until the dedicated `/agenda/<ord>` route ships, each row links to an in-page anchor (`#agenda-<ord>`).
2. **Stenograma (body)** — for each agenda item (in `position_in_document` ASC), a section header + an ordered list of every child record under it: speeches (full text, paragraph-split on blank lines, addressable as `#discurs-<position_in_document>`), votes (outcome + counts), interpellations (questioner / topic / question text), and questions (regnum / questioner / topic). Children that arrive before the first agenda boundary fall into an unlabelled leading section.

The page does not filter on `is_substantive` — the whole stenographic record is shown, including procedural turns, because this is the archive surface, not the search surface.

## Caching and ISR invalidation

- Detail pages → `force-static` with `revalidate: 3600` and `revalidateTag('mo-<grain>:<id>')`.
- Search results → `Cache-Control: s-maxage=60, stale-while-revalidate=300`.
- Sitemaps → `force-static`, regenerated nightly.

The Python indexer (`monitorul-ii index`) calls a webhook on every successful upsert with the affected `(grain, record_id)` pairs. This app exposes the receiving route, validates the shared secret, and calls `revalidateTag` for each pair so freshly-indexed records appear without a full rebuild.

## Credentials

Two API keys are minted by `monitorul-ii es-init`. **This app uses only `monitorul_reader`** — read-only on `mo-*`, no scripting, no scroll, no `_sql`, no cluster info. The `monitorul_indexer` key never leaves the Python pipeline.
