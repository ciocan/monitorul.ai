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
ES_VERIFY_CERTS=1
EMBED_URL=http://127.0.0.1:8000      # optional; only required for hybrid (RRF) search
```

The `monitorul_reader` key and the optional embedding service both come from the [`monitorul-ii`](https://github.com/ciocan/monitorul-ii) repo.

## Releases

Automated via [release-please](https://github.com/googleapis/release-please) on push to `main`. Use [Conventional Commits](https://www.conventionalcommits.org/).
