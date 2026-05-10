# MCP server (V1)

A public, OAuth-authenticated Model Context Protocol server hosted alongside this Next.js app on Vercel. Lets any MCP-capable client (Claude Desktop, Cursor, Cline, claude.ai, …) ask complex multi-step questions over the Romanian parliamentary corpus, with per-user attribution.

This document is the V1 design contract. Companion to [`architecture.md`](./architecture.md) — that doc describes the data layer this surfaces; this doc describes the tool surface the LLM sees.

## Boundary

```
  Any MCP client                    monitorul.ai (this repo)               Elasticsearch
  ───────────────                   ────────────────────────               ──────────────
  Claude Desktop                    /mcp/server                            mo-* aliases
  Cursor / Cline      ──MCP+OAuth──▶┌───────────────────────────┐          ┌──────────┐
  claude.ai                         │  withMcpAuth(auth, …)      │  ────▶  │  read    │
  Custom agents                     │  → mcp-handler             │   API   │  via     │
                                    │  → 16 Zod tools            │   key   │ reader   │
                                    │  → src/lib/search.ts       │          └──────────┘
                                    │  → src/lib/embed.ts (cloud)│
                                    │  → Upstash ratelimit (×2) │
                                    └───────────────────────────┘
                                          │             │
                          /api/auth/*  ◄──┘             ▼
                          /.well-known/*       OVH Kepler / DeepInfra
                          ┌───────────────┐    (BGE-M3 embed, query-time)
                          │ Better Auth    │
                          │ MCP plugin     │  ───── user / session / oauth_*
                          │ Google OAuth   │  ◄────────  Neon Postgres
                          └───────────────┘            (pooler.neon.tech)
```

- **Hosting** lives in this Next.js app on Vercel — no separate Cloudflare Worker. The MCP is a Next.js route handler at `src/app/mcp/server/route.ts`, registered via the [`mcp-handler`](https://www.npmjs.com/package/mcp-handler) wrapper and gated by Better Auth's `withMcpAuth(auth, …)`.
- **Authentication** is OAuth 2.0 + PKCE + Dynamic Client Registration via Better Auth's [`mcp` plugin](https://better-auth.com/docs/plugins/mcp). Every request to `/mcp/server` carries a verified bearer token; unauthenticated callers get `401` with `WWW-Authenticate: Bearer resource_metadata="…"` per RFC 9728. Backing store is Neon Postgres via the Drizzle adapter (`src/lib/db/client.ts`).
- **Data path** is `MCP tool → src/lib/search.ts → ES`. The MCP is a thin Zod-typed wrapper over the existing TypeScript query layer that already powers the web app. There is no protocol drift between the web pages and the MCP — same functions, same `url_path` values, same speaker shapes.
- **Embedding** for the RRF/kNN paths reuses `src/lib/embed.ts`'s cloud provider (`EMBED_PROVIDER=cloud`), already wired with OVH Kepler primary and DeepInfra fallback.
- **Citation URLs** point at this same site (`/discurs/<slug>`, `/mo/<id>`, `/politicieni/<slug>`) — same origin, one-click verifiable.

## V1 design decisions

| Decision                  | Choice                                               | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audience                  | Public, OAuth-authenticated, open self-serve         | Free of charge but every caller has a stable identity. Single Google social provider for V1; DCR-registered MCP clients delegate sign-in via Better Auth's `mcp` plugin. Anonymous tier dropped before launch — there is no anonymous traffic to migrate.                                                                                                                                                                                                                                                                              |
| Granularity               | Thin primitives, ~16 tools, 1:1 with `lib/search.ts` | LLM composes multi-step; no opinionated "recipes" baked into tool surface                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Scope                     | Substrate only                                       | The canonical-queries / discourse-analysis tier (populism, DQI, voice) needs the corpus coded first — V2                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Hit shape                 | Cataloguer mode (id + url + ~240ch excerpt + meta)   | Right balance of context budget and source-pinning for multi-step composition                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Discoverability           | One `describe_corpus` meta-tool                      | Keeps tool descriptions tight; LLM self-bootstraps chambers / topics / counts                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Search default            | RRF (BM25 + kNN, fused client-side)                  | Romanian benefits from synonym tolerance; existing `fuseRrfIds` ports cleanly                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Bulk export               | Skipped V1                                           | Page-by-page + aggs handle individual citation-grade work; bulk research deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Rate limiting             | Upstash Ratelimit + Upstash Redis (free tier)        | Cheapest Vercel-native pattern; per-IP sliding window; tighter on RRF/kNN                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Tool description language | Romanian                                             | Audience match — the corpus, the presentation page, and the filter values are all Romanian. Modern LLMs handle Romanian tool descriptions identically to English; the ~30% token inflation is negligible against the consistency win on the human-facing surface (Claude Desktop, Cursor, Codex display tool titles/descriptions in their UIs). Reverted from the original "English / universal MCP ergonomics" decision once the surface stabilised. Tool _names_ stay snake_case English (programmatic identifiers; MCP convention). |

## Tool inventory

Sixteen tools. Every tool is a Zod-typed wrapper over an existing function in `src/lib/search.ts`.

| Tool                         | Wraps                                | Purpose                                                               |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `describe_corpus`            | new — `src/lib/describe-corpus.ts`   | Meta. Chambers, topics, date range, dynamic counts, URL templates     |
| `search_speeches`            | `searchSpeeches`                     | Hybrid RRF default; `rank_fusion: bm25-only \| rrf \| knn-only` param |
| `search_persons`             | `searchPersons`                      | Fuzzy MP / minister / chair name search                               |
| `politicians_index`          | `politiciansIndex`                   | Ranked MP directory (year, sort, page)                                |
| `committees_index`           | `committeesIndex`                    | Committee directory by activity                                       |
| `sessions_index`             | `sessionsIndex`                      | Year-bucket session counts                                            |
| `get_document`               | `getDocument`                        | Lookup by `mo://YYYY/PART/ISSUE`                                      |
| `get_agenda_item`            | `getAgendaItem`                      | Lookup by record_id                                                   |
| `get_speech`                 | `getSpeech`                          | Lookup with full body text (called when LLM needs to quote)           |
| `get_report`                 | `getReport`                          | Lookup by record_id                                                   |
| `person_page`                | `personPage` (line 1728)             | Full MP dossier (person + recent speeches + stats + activity)         |
| `list_document_children`     | `listDocumentChildren`               | Full-doc playback in source order                                     |
| `list_documents_by_date`     | `listDocumentsByDate`                | Browse by date + chamber                                              |
| `list_committee_meetings`    | `listCommitteeMeetings`              | Per-committee meeting list                                            |
| `committee_page`             | `committeePage` (line 835)           | Per-committee dossier                                                 |
| `agg_speeches_by_party_year` | `aggSpeechesByPartyYear` (line 1872) | Party × year trend buckets                                            |

System prompt budget at the LLM: ~3K tokens for tool descriptions, including the inline Romanian filter values.

## Hit shape contract — cataloguer mode

Every search-result hit (the output of `search_speeches` and any future search-shape tool) is trimmed to a fixed shape so multi-step queries don't exhaust the LLM's context.

```ts
interface CatalogueHit {
  record_id: string; // mo://YYYY/PART/ISSUE#suffix
  url_path: string; // canonical /discurs/<slug> (slug-once)
  absolute_url: string; // NEXT_PUBLIC_SITE_URL + url_path
  document_id: string;
  document_url_path: string; // /mo/YYYY/PART/ISSUE
  document_anchor_url_path: string | null; // /mo/.../#discurs-<position>, in-context reading
  speaker: {
    person_id: string | null;
    canonical_name: string;
    slug: string | null; // /politicieni/<slug>
    party_group: string | null;
  };
  date: string; // session_date, ISO
  chamber: "Camera Deputaților" | "Senatul" | "joint";
  agenda_title: string | null;
  excerpt: string; // 240ch ES highlight, falls back to first 240ch
  refs: {
    bills: string[];
    laws: string[];
    codes: string[];
  };
}
```

`url_path` is the standalone `/discurs/<slug>` page — slug-once, citation-grade, the address an LLM should hand to a fact-checker. `document_anchor_url_path` is the same speech rendered inline within the parent stenogram (`/mo/<year>/<part>/<issue>#discurs-<position_in_document>`) — pick this when surfacing "read in the original sitting" context. Both 200; the standalone page 308-redirects renamed slug-prefix variants to canonical.

Lookup tools (`get_*`, `person_page`, `committee_page`, `list_document_children`) return the **untrimmed** lib/search.ts shapes — they're detail views, not search hits. The LLM calls `get_speech(record_id)` when it needs the full body text for a verbatim quote.

`src/lib/mcp-adapters.ts` owns the `_source → CatalogueHit` transform. ES `highlight` clause uses the `unified` highlighter with a 240-char fragment size on the `text` field for speeches and `canonical_name` for persons. When ES returns no highlight (e.g., a vector-only kNN match with no matching terms), the adapter falls back to the first 240 chars of the body.

## Search semantics — RRF default

`search_speeches` accepts a `rank_fusion` enum:

| Mode            | When to use                                                            | Behaviour                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rrf` (default) | Thematic queries: `"locuințe"` matches `"imobile"`, `"spațiu locativ"` | Vectorise query via `lib/embed.ts` cloud path → run BM25 + kNN as parallel ES `_search` → fuse client-side via `fuseRrfIds` (rank_constant=60, rank_window_size=max(page·page_size, 100), num_candidates=max(rank_window_size·10, 100)) |
| `bm25-only`     | Acronyms, proper nouns, exact phrases: `"PNRR"`, `"Codul muncii"`      | Single ES `_search`; no embed call                                                                                                                                                                                                      |
| `knn-only`      | Ablation / debug                                                       | Pure kNN; returns empty when no query vector — the explicit signal that the embed service is misconfigured                                                                                                                              |

Graceful degradation: if the embed call fails during `rrf`, results degrade to BM25-only with a `degraded: true` flag in the tool result. `knn-only` still returns empty on embed failure (no silent fallback — the empty result is the diagnostic).

The `rank_fusion` param exists primarily as an LLM-accessible lever for the rare cases where it should override the default. The tool description guides correct use.

## Discoverability — `describe_corpus`

A single meta-tool the LLM is nudged to call once per session. Returns:

```ts
{
  enums: {
    chambers: ["Camera Deputaților", "Senatul", "joint"],
    topics: [/* 15 topic slugs from extraction/topics.py */],
    reference_types: ["bill", "law", "code", "oug", "og", /* ... */],
  },
  url_templates: {
    document: "/mo/<year>/<part>/<issue>",
    speech: "/discurs/<slug>",
    person: "/politicieni/<slug>",
    committee: "/comisii/<id>",
  },
  counts: {                       // dynamic — one ES _count per grain
    documents: number,
    speeches: number,
    votes: number,
    persons: number,
    /* ... */
  },
  date_range: {                   // ES min/max agg over mo-documents.session_date
    earliest: string,
    latest: string,
  },
  routing_hints: string,          // free text on which tool fits which question shape
}
```

Cost: two ES calls (counts via `_count` per grain in parallel; date range via single agg). Cacheable to KV for ~5 minutes; not done in V1 since the calls are cheap.

## Rate limiting

Upstash Ratelimit + Upstash Redis (free tier covers 10K commands/day) in front of every authenticated tool invocation. Two axes (per-IP, per-user), two tiers each (general + heavy). A request must clear **both** axes; whichever 429s first short-circuits.

| Limiter          | Quota                       | Applied to                                             |
| ---------------- | --------------------------- | ------------------------------------------------------ |
| `general` (IP)   | 30 requests / minute / IP   | Every tool call                                        |
| `general` (user) | 30 requests / minute / user | Every tool call                                        |
| `heavy` (IP)     | 20 requests / minute / IP   | `search_speeches` when `rank_fusion ∈ {rrf, knn-only}` |
| `heavy` (user)   | 20 requests / minute / user | `search_speeches` when `rank_fusion ∈ {rrf, knn-only}` |

The two axes are defense in depth:

- **Per-IP** catches a single network origin (botnet node, scraper, single token leaked across many clients) overwhelming the route, regardless of which user account is in play.
- **Per-user** catches a single account spread across rotating IPs (cloud functions, residential proxies). Bound to the Better Auth `userId` supplied by `withMcpAuth`.

`src/lib/ratelimit.ts` exports four limiters. IP extraction reads `x-forwarded-for` (Vercel sets this) with `cf-connecting-ip` fallback if Cloudflare ever fronts the deployment. The `userId` axis is supplied by Better Auth's session record — every request to `/mcp/server` has one.

429 responses include `Retry-After` semantics in the structured tool error result, with a `scope` field (`general:ip`, `general:user`, `heavy:ip`, `heavy:user`) so a debugging client can distinguish the two axes.

Env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Validated at build time per the existing `@t3-oss/env-nextjs` pattern in `src/env.ts`.

## Authentication

The OAuth dance is fully handled by Better Auth's `mcp` plugin in `src/lib/auth.ts`. From the AI client's perspective the flow is transparent — `mcp-remote` and the native MCP clients (Claude Desktop ≥ 0.7, Cursor, Cline) implement DCR + PKCE without configuration changes.

Operational setup — Neon Postgres, Google OAuth Console, Vercel env vars — is in [`auth-setup.md`](./auth-setup.md). This section is the design contract.

### Discovery routes (public)

- `/.well-known/oauth-protected-resource` — RFC 9728 PRM document. Names the authorization servers, JWKS, supported scopes, bearer methods. Served by `oAuthProtectedResourceMetadata(auth)` at `src/app/.well-known/oauth-protected-resource/route.ts`.
- `/.well-known/oauth-authorization-server` — RFC 8414 authorization-server metadata. Issuer URL, authorization / token / registration / userinfo / jwks endpoints. Served by `oAuthDiscoveryMetadata(auth)` at `src/app/.well-known/oauth-authorization-server/route.ts`.

Both are unauthenticated; the wrapper `withMcpAuth` only protects `/mcp/server`.

### Connecting (first time)

What a user sees when they wire up an MCP client for the first time:

1. The client calls `/mcp/server` with no Authorization header. The route returns `401` with `WWW-Authenticate: Bearer resource_metadata="<host>/api/auth/.well-known/oauth-protected-resource"`.
2. The client (or `mcp-remote` on its behalf) reads PRM, then the AS metadata, then registers itself dynamically via `POST /api/auth/mcp/register` — no API key, no human-mediated client setup.
3. The client opens the user's browser at `/api/auth/mcp/authorize?…` with PKCE parameters.
4. If the browser has no `monitorul.ai` session, Better Auth redirects to `/cont/intra` (the themed sign-in page). Google OAuth completes, the user lands on `/cont/consimt` with a themed consent screen showing the registered client name and redirect URL.
5. After consent, the authorization code redirects back to the client. Token exchange at `/api/auth/mcp/token` swaps the code for an access token (~24h) and refresh token (~30d).
6. Subsequent requests carry `Authorization: Bearer <access_token>`. Refresh is automatic; the user only sees the OAuth dance again if they revoke the client from `/cont`.

### Token lifecycle and revocation

Token TTLs are Better Auth defaults: ~24h access, ~30d refresh. Revoking a client from `/cont` deletes both `oauth_access_token` rows and `oauth_consent` rows for `(userId, clientId)`. Outstanding access tokens cached client-side keep working until they expire (no synchronous invalidation in the V1 plugin) — the access TTL is short enough that this is acceptable per the auth handoff.

Per-call attribution is stamped on every `mo_query_log` row via `user_id`. The MCP route extracts `session.userId` from the Better Auth session and runs the handler inside `requestContext.run({ userId, … }, …)`; downstream `logQuery` reads it from the AsyncLocalStorage scope. Web traffic and the autocomplete API leave `user_id` `null`.

## Use cases enabled

V1 is a thin substrate. The use cases below all work the day it ships, by composition over the 16 tools.

- **Conversational civic Q&A** — Claude Desktop / Cursor / Cline / claude.ai users ask "what did MP X say about Y?", "who voted on the budget?", "find quotes from yesterday's session". The cataloguer hit shape + same-origin citations make every answer one-click verifiable.
- **Citation-grade individual fact-checking** — AI-driven journalism tools verify quotes via `search_speeches` → `get_speech` round-trips.
- **Per-MP dossiers / constituent lookups** — `search_persons` → `person_page` → `search_speeches(speaker_person_id=...)` builds rich profiles in 2–3 calls.
- **Full-document playback for any date** — `list_documents_by_date` → `list_document_children` renders an entire MO in source order with all activities interleaved.
- **MCP composability** — Claude can fan out across this MCP plus a web-search MCP plus a Twitter/Mastodon MCP, and synthesise: "what's the gap between what MP X says publicly online vs in parliament?". The multiplier MCP architecture gives that REST APIs do not.
- **Custom Claude Projects / GPTs** — third parties wrap this MCP with their own system prompt encoding methodology, e.g., "Romanian Parliament Research Assistant" Project. The MCP is the data layer; the Project is the interface.
- **Civic-tech NGO dashboards** — watchdog tools, voting trackers, parliamentary scoreboards built by third parties pointing Claude at the MCP. They do not need to scrape, run extraction, or maintain ES.
- **Education** — civics teachers, journalism schools, university courses on Romanian politics use Claude+MCP for research-methodology coursework.
- **Voice / multimodal interfaces** — any layer that can call Claude inherits the MCP automatically.

## Deferred to V2

| Feature                                       | What unlocks it                                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-tool / per-category scope partitioning    | Today there's a single default `mcp` scope. A research-only scope (no aggregations) and a write scope (corrections workflow) are deferred.            |
| Bulk export / dataset assembly                | A new `export_*` tool surface; possibly async jobs landing CSV/JSONL into R2                                                                          |
| Canonical-queries methodology layer           | Discourse-analysis pipeline (`prompts/`, `validation/`) running on the corpus; new tools that auto-emit disclaimers, parallel rankings, bootstrap CIs |
| Real-time alerts                              | Persistent state — Upstash Redis or Durable Objects; webhook side-channel                                                                             |
| Scheduled-agent ergonomics                    | Idempotent "fetch yesterday's session" shape; daily-digest helper tools                                                                               |
| Hybrid embedded chat (web app's own AI panel) | Same MCP called server-to-server from a chat component                                                                                                |
| Cross-corpus synthesis                        | Other parliaments expose MCPs; Claude cross-references                                                                                                |

## Build phases

The implementation is a sequence of vertical slices. Each slice cuts end-to-end through the MCP route, lib functions, types, and Zod schemas, and is independently demoable / verifiable.

### Phase 1 — Tracer bullet (route + describe_corpus)

The smallest end-to-end MCP. Install `@vercel/mcp-adapter`, mount the route at `src/app/api/mcp/[transport]/route.ts` with SSE + streamable HTTP transports, and ship one tool — `describe_corpus`. Per `AGENTS.md`, read `node_modules/next/dist/docs/` for current Next.js 16 route handler conventions before writing the route — training data is stale.

**Done when:**

- `@vercel/mcp-adapter` installed; route handler exports the adapter convention
- `src/lib/describe-corpus.ts` exposes `describeCorpus(): Promise<CorpusDescription>` (one ES call for counts, one for date range)
- Tool registered with English description that surfaces Romanian filter values inline
- `npx @modelcontextprotocol/inspector http://localhost:3020/api/mcp/sse` lists the tool and returns valid JSON
- README has a `claude_desktop_config.json` snippet
- `bun run typecheck` / `bun run lint` clean

### Phase 2 — Lookup tools

Five thin wrappers around single-record fetchers. No cataloguer adapter needed — these are detail views.

`get_document` → `getDocument` (line 163) ; `get_agenda_item` → `getAgendaItem` (line 182) ; `get_speech` → `getSpeech` (line 199) ; `get_report` → `getReport` (line 216) ; `person_page` → `personPage` (line 1728).

Null returns become structured `{ found: false }` tool results, never thrown errors.

### Phase 3 — Search tools + cataloguer adapter (BM25 only)

`src/lib/mcp-adapters.ts` exposes `toCatalogueHit(esHit, highlight)`. `search_speeches` ships with `rank_fusion="bm25-only"` only (the param accepts the other modes but returns a "not yet implemented" structured result). `search_persons` ships fully.

`is_substantive=true` default on `search_speeches`; `page_size` clamped to 50.

### Phase 4 — Hybrid RRF in search_speeches

Default flips to `rrf`. Wires `lib/embed.ts` cloud path through. Implements the RRF + kNN-only branches. Graceful degradation to BM25 on embed failure (`degraded: true` flag); kNN-only stays empty on embed failure.

Tagged in the request context so phase 8's heavy limiter can target RRF/kNN calls.

### Phase 5 — List tools

`list_document_children` (cap 500, matches `PLAYBACK_PAGE_SIZE` in queries.py) ; `list_documents_by_date` ; `list_committee_meetings`. Return existing TS shapes from `lib/types.ts` directly — no cataloguer adapter.

### Phase 6 — Index / directory tools

`politicians_index` ; `committees_index` ; `sessions_index` ; `committee_page`. Page-shaped, like the web app's index pages. Pagination metadata flows through unchanged.

### Phase 7 — Aggregation tool

`agg_speeches_by_party_year` (lib/search.ts:1872). Returns the buckets verbatim — LLMs read nested JSON fine. `is_substantive=true` always-on; `size` clamped to 100.

### Phase 8 — Rate limiting

`src/lib/ratelimit.ts` exports both limiters; sliding window; route-handler wrap. Layerable independently of the tool slices.

### Phase 9 — Production poke + tool description tuning (HITL)

Connect from Claude Desktop, Cursor, Cline against the production deployment. Run a fixed list of canonical complex queries:

- "What did George Simion say about the EU in 2024?"
- "Render the full Senate session from yesterday."
- "Who spoke most about housing in 2024?"
- "Build a dossier on Senator X."
- "Find every speech that references Codul muncii."

Grade Claude's tool-call sequences. Identify tool descriptions where the LLM misuses the tool (wrong tool, wrong filter values, ignored defaults) and tune. Add a "Connecting via MCP" section to the README with copy-pasteable config for each client. Optional: `docs/mcp-walkthrough.md` with 3–5 worked examples.

## Files added or changed

| Path                                                       | Status    | Purpose                                                                  |
| ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `src/app/mcp/server/route.ts`                              | new       | `mcp-handler` mount, 16 Zod tools, `withMcpAuth` wrapper                 |
| `src/app/api/auth/[...all]/route.ts`                       | new       | Better Auth catch-all (sign-in, OIDC endpoints, MCP DCR / token)         |
| `src/app/.well-known/oauth-protected-resource/route.ts`    | new       | RFC 9728 PRM document                                                    |
| `src/app/.well-known/oauth-authorization-server/route.ts`  | new       | RFC 8414 AS metadata                                                     |
| `src/app/cont/page.tsx`, `src/app/cont/intra/page.tsx`,    | new       | Account pages: sign-in, authorized clients list + revoke, themed consent |
| `src/app/cont/consimt/page.tsx`, `src/app/cont/actions.ts` | new       | Server actions for sign-in / sign-out / revoke / consent                 |
| `src/app/cont/consimt/actions.ts`                          | new       | Server actions wrapping Better Auth's `oAuthConsent` endpoint            |
| `src/components/account-chip.tsx`                          | new       | Header chip surfaces session state + sign-out menu                       |
| `src/lib/auth.ts`                                          | new       | `betterAuth({...})` with Drizzle adapter, Google provider, `mcp` plugin  |
| `src/lib/db/client.ts`                                     | new       | Shared Postgres pool + Drizzle client                                    |
| `src/lib/db/schema.ts`                                     | generated | `bunx better-auth generate` output (user, session, account, oauth\_\*)   |
| `src/lib/db/migrations/`                                   | generated | drizzle-kit SQL migrations                                               |
| `drizzle.config.ts`                                        | new       | drizzle-kit config (uses `DATABASE_DIRECT_URL` for migrations)           |
| `src/lib/describe-corpus.ts`                               | new       | Meta-tool data source                                                    |
| `src/lib/mcp-adapters.ts`                                  | new       | `_source → CatalogueHit` with 240ch highlights                           |
| `src/lib/ratelimit.ts`                                     | new       | Upstash setup; general + heavy limiters × IP + user axes                 |
| `src/lib/request-context.ts`                               | edit      | AsyncLocalStorage scope; gains `userId` for query-log attribution        |
| `src/lib/search.ts`                                        | edit      | `QueryLogEntry.user_id` field; reads `userId` from `requestContext`      |
| `src/lib/embed.ts`                                         | unchanged | Cloud path is already production-wired                                   |
| `src/lib/types.ts`                                         | unchanged | All shapes already defined                                               |
| `src/env.ts`                                               | edit      | Add `DATABASE_URL`, `DATABASE_DIRECT_URL`, `BETTER_AUTH_*`, `GOOGLE_*`   |
| `.env.example`                                             | edit      | Document the new auth + Neon vars                                        |
| `README.md`                                                | edit      | "Connecting via MCP" section + "Prima conectare" line                    |
| `package.json`                                             | edit      | `better-auth`, `drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`           |

## Open ops decisions (engineering, not design)

- **ES connectivity from Vercel**. The web app already reaches ES via `ES_URL` — the MCP inherits this. Not a fork.
- **Embed-provider failover policy**. OVH primary, DeepInfra fallback per the existing `lib/embed.ts`. No design decision pending.
- **Telemetry**. Vercel Analytics + the existing `monitorul_query_log` (gated by `QUERY_LOG_WRITE`). Now stamped with `user_id` for the MCP surface.
- **Two Google OAuth clients per environment**. Provision `prod` (`monitorul.ai/api/auth/callback/google`) and `dev` (localhost + `*.vercel.app` preview redirect URIs) in Google Cloud Console. The dev client must list both URIs.
- **`BETTER_AUTH_SECRET` rotation**. Rotation invalidates all refresh tokens — users re-auth on next call. Acceptable trade; rotate at least yearly.
- **Cloudflare DNS-proxy in front of Vercel** as an optional V2 layer — adds free DDoS protection without giving up Vercel hosting. Two control planes; small DNS reorg.

## References

- [`architecture.md`](./architecture.md) — the data layer this surfaces.
- `monitorul-ii` repo: `/home/ciocan/projects/monitorul/docs/elasticsearch-indexing.md` (Q9 — query layer design), `/home/ciocan/projects/monitorul/src/monitorul_ii/elasticsearch/queries.py` (Python sister of `lib/search.ts`).
- `monitorul-ii` repo: `/home/ciocan/projects/monitorul/docs/canonical-queries.md` — the V2 methodology layer (populism / DQI / voice rankings) that will ship as MCP tools once the discourse-analysis pipeline runs on the corpus.
- [Better Auth — MCP plugin](https://better-auth.com/docs/plugins/mcp)
- [`mcp-handler`](https://www.npmjs.com/package/mcp-handler)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [RFC 9728](https://datatracker.ietf.org/doc/rfc9728/) (OAuth 2.0 Protected Resource Metadata)
- [RFC 8414](https://datatracker.ietf.org/doc/rfc8414/) (OAuth 2.0 Authorization Server Metadata)
