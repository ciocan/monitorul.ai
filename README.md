# monitorul.ai

Public website for browsing and searching Romania's _Monitorul Oficial Partea a II-a_ (parliamentary records).

This repo is the **read-only frontend**. The scraping, extraction, and Elasticsearch indexing pipeline lives in [`monitorul-ii`](https://github.com/ciocan/monitorul-ii). This app queries the indices produced by that pipeline.

For the data shape this app reads from, see [`docs/architecture.md`](./docs/architecture.md).

## Develop

```sh
bun install
bun run dev          # http://localhost:3020
```

| Command                     | What it does             |
| --------------------------- | ------------------------ |
| `bun run dev`               | dev server               |
| `bun run build`             | production build         |
| `bun run start`             | run the production build |
| `bun run lint` / `lint:fix` | oxlint                   |
| `bun run fmt` / `fmt:check` | oxfmt                    |

Bun is the runtime (Next is invoked via `bun --bun`).

## Environment

```
ES_URL=https://es.example.com:9200
ES_API_KEY=<read-only "monitorul_reader" API key minted by monitorul-ii es-init>
ES_VERIFY_CERTS=                          # leave unset for self-signed; set to 1 only on managed ES
EMBED_PROVIDER=local                      # local | cloud — picks the embed backend for hybrid search
EMBED_URL=http://127.0.0.1:8000           # `local` provider: FastAPI embedder (monitorul-ii)
EMBED_CLOUD_URL=                          # `cloud` provider: OpenAI-compatible /v1/embeddings URL
EMBED_CLOUD_TOKEN=                        # `cloud` provider: bearer token
EMBED_CLOUD_MODEL=bge-m3                  # model id sent in the payload (default bge-m3)
QUERY_LOG_WRITE=                          # set to 1 to write search telemetry to monitorul_query_log

# S3-compatible storage (Cloudflare R2 in prod) for the original PDFs.
# Bucket stays PRIVATE — the server mints short-lived presigned URLs and
# 302-redirects from /mo/<year>/<part>/<issue>/pdf. Leave blank for
# search-only deployments; the PDF link is hidden when unset.
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=monitorul-ii
S3_REGION=auto

NEXT_PUBLIC_SITE_URL=https://monitorul.ai
```

Validated at startup by [`src/env.ts`](./src/env.ts) (via `@t3-oss/env-nextjs` + Zod). `next dev` and `next build` fail fast on missing or malformed values. Set `SKIP_ENV_VALIDATION=1` to bypass (useful for lint-only CI). The `monitorul_reader` key and the local embedder both come from the [`monitorul-ii`](https://github.com/ciocan/monitorul-ii) repo; `NEXT_PUBLIC_SITE_URL` controls absolute canonical URLs and JSON-LD `@id` values.

**Embed provider toggle.** `EMBED_PROVIDER=local` (default) calls the FastAPI embedder at `EMBED_URL` — the dev path against the monitorul-ii box. `EMBED_PROVIDER=cloud` calls any OpenAI-compatible `/v1/embeddings` endpoint that serves BGE-M3 (1024-dim) at `EMBED_CLOUD_URL` with `Authorization: Bearer $EMBED_CLOUD_TOKEN` — required when running on Vercel where the local embedder is unreachable. Both sets of creds can stay populated in `.env.local`; flip the single `EMBED_PROVIDER` line to switch. Either provider missing creds → embed returns null → search silently degrades to BM25.

## Routes (current)

| Path                                           | Status        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                            | live          | civic-gazette landing with archive stats register, ISR 1h                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/mo`                                          | live          | sessions register — per-year sparkbar over the whole archive plus the document list for the selected year (defaults to most recent active year, switch via `?year=YYYY`). `?year=` is non-canonical; `alternates.canonical` always points at `/mo`. JSON-LD `CollectionPage`, ISR 1h.                                                                                                                                                                          |
| `/mo/[year]/[part]/[issue]`                    | live          | document page — Cuprins (TOC) + inline Stenograma body (speeches grouped under each agenda item, in source order), JSON-LD, ISR 1h                                                                                                                                                                                                                                                                                                                             |
| `/mo/[year]/[part]/[issue]/pdf`                | live          | route handler — 302-redirects to a 5-min SigV4-presigned R2 URL for the original PDF. Bucket stays private (creds never leave the server). Hidden from the document page when `S3_*` env vars aren't set.                                                                                                                                                                                                                                                      |
| `/cauta?q=…`                                   | live          | hybrid speech search (BM25 + kNN/RRF), highlights, `noindex, follow`. Each hit shows a word count + 5-segment length meter alongside the snippet, links the speaker name to their politician page when `person_id` is populated, and ships an explicit "Vezi în context →" link to the document anchor. Diacritic-insensitive: a query for `sosoaca` matches indexed `șoșoacă` via the `.folded` subfields on `text` / `agenda_title` / `speaker.name_search`. |
| `/politicieni`                                 | live          | politicians register — per-year sparkbar plus the top 100 most active politicians for the selected year. Inline `Ordonare:` toggle flips between substantive-only (default, `?mode=substantive`) and all interventions including procedural turn-taking (`?mode=all`). Defaults to most recent active year, switch via `?year=YYYY`. JSON-LD `CollectionPage`, ISR 1h.                                                                                         |
| `/politicieni/[slug]`                          | live          | person profile — name, mandates, paginated recent speeches (20 per page; each row shows word count + 5-segment length meter), JSON-LD `Person`, ISR 1h. Linked conditionally from speech blocks (`speaker.person_id` is non-null only after the upstream `backfill --kind=persons` + `index --force --grain=mo-speeches` passes have run; ~20% today).                                                                                                         |
| `/comisii`, `/despre`, agenda/speech/vote/etc. | not yet wired | linked from chrome but ship in subsequent phases                                                                                                                                                                                                                                                                                                                                                                                                               |

All ES interaction goes through [`src/lib/search.ts`](./src/lib/search.ts) — the only path from app code to Elasticsearch.

## Releases

Automated via [release-please](https://github.com/googleapis/release-please) on push to `main`. Use [Conventional Commits](https://www.conventionalcommits.org/).
