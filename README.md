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
ES_VERIFY_CERTS=                     # leave unset for self-signed; set to 1 only on managed ES
EMBED_URL=http://127.0.0.1:8000      # optional; only required for hybrid (RRF) search
NEXT_PUBLIC_SITE_URL=https://monitorul.ai
```

The `monitorul_reader` key and the optional embedding service both come from the [`monitorul-ii`](https://github.com/ciocan/monitorul-ii) repo. `NEXT_PUBLIC_SITE_URL` controls absolute canonical URLs and JSON-LD `@id` values.

## Routes (current)

| Path                                                           | Status        | Notes                                                              |
| -------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| `/`                                                            | live          | civic-gazette landing with archive stats register, ISR 1h          |
| `/mo/[year]/[part]/[issue]`                                    | live          | document page, JSON-LD, canonical, ISR 1h                          |
| `/cauta?q=…`                                                   | live          | speech BM25 search with highlights + pagination, `noindex, follow` |
| `/politicieni`, `/comisii`, `/despre`, agenda/speech/vote/etc. | not yet wired | linked from chrome but ship in subsequent phases                   |

All ES interaction goes through [`src/lib/search.ts`](./src/lib/search.ts) — the only path from app code to Elasticsearch.

## Releases

Automated via [release-please](https://github.com/googleapis/release-please) on push to `main`. Use [Conventional Commits](https://www.conventionalcommits.org/).
