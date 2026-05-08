# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Design Context

Strategic design context lives in `PRODUCT.md` (root). Visual system context lives in `DESIGN.md` (root, when generated). Both are loaded by the `impeccable` skill via `node ~/.claude/skills/impeccable/scripts/load-context.mjs`.

- **Register:** `brand` — every page IS content; design recedes so the parliamentary record leads.
- **Personality:** civic, durable, exact. Neutral archive voice; editorial-archival aesthetic family (ProPublica / ICIJ / theyworkforyou.com lane).
- **Anti-references:** SaaS marketing chrome, government-portal stiffness, news partisanship, crypto/hacker terminal cosplay.

When designing or refining UI, read `PRODUCT.md` first.

## Commands

Bun is the runtime and package manager. Next is invoked through Bun (`bun --bun next ...`) so it runs on the Bun runtime, not Node.

- `bun run dev` — start the dev server
- `bun run build` — production build
- `bun run start` — run the production build
- `bun run lint` / `bun run lint:fix` — **oxlint** (not ESLint). Config: `.oxlintrc.json`
- `bun run fmt` / `bun run fmt:check` — **oxfmt** (not Prettier). Config: `oxfmtrc.config.ts`
- `bun run typecheck` — **tsc** (not tsc-alias). Config: `tsconfig.json`

No test runner is configured.

## Architecture

- **Next.js 16 App Router** under `src/app/`. Read `node_modules/next/dist/docs/` for any framework API — see `AGENTS.md`.
- **React 19** with RSC enabled (`components.json` → `"rsc": true`).
- **Tailwind CSS v4** wired through PostCSS (`@tailwindcss/postcss`). There is no `tailwind.config.*` — theme tokens live in `src/app/globals.css` via `@theme inline { ... }` and `@custom-variant dark`. The CSS also imports `shadcn/tailwind.css` (the registry's stylesheet) and `tw-animate-css`.
- **shadcn/ui** with a non-default style: `components.json` uses `"style": "radix-lyra"` and `"baseColor": "neutral"`. Generated UI components live in `src/components/ui/` and import `Slot` from `radix-ui` (the umbrella package), not `@radix-ui/react-slot`.
- **Path alias**: `@/*` → `src/*` (see `tsconfig.json`). Aliases for `components`, `ui`, `lib`, `hooks`, `utils` are defined in `components.json`.
- **`cn` helper**: `src/lib/utils.ts` exports `cn(...inputs)` = `twMerge(clsx(inputs))`. Use it for all conditional class composition.
- **Fonts** are loaded in `src/app/layout.tsx` via `next/font/google` and exposed as CSS variables: `--font-sans` (Public Sans), `--font-display` (Source Serif 4), `--font-mono` (IBM Plex Mono). The three-voice system is documented in `DESIGN.md` §3.
- **Routes (Next.js 16 App Router)**: `/` (landing, ISR 1h, archive stats register), `/mo` (sessions register — `font-display` heading, per-year sparkbar over `sessionsIndex({ year })`, list of documents for the selected year sorted by `session_date` desc; defaults to the most recent active year, switchable via `?year=YYYY`; `?year=` is non-canonical — `alternates.canonical` always points at `/mo`; ISR 1h, JSON-LD `CollectionPage`), `/politicieni` (politicians register — same year-sparkbar shape, ranked list of top 100 politicians for the selected year via `politiciansIndex({ year, substantiveOnly })`; rankings come from `mo-speeches` aggregations because `mo-persons.stats` is empty in the corpus today. Inline `Ordonare:` toggle flips `?mode=substantive` (default — only `is_substantive: true` speeches counted) vs `?mode=all` (every intervention, including procedural turn-taking). Defaults to most recent active year, switchable via `?year=YYYY`; `?year=` and `?mode=` are non-canonical, ISR 1h, JSON-LD `CollectionPage`), `/mo/[year]/[part]/[issue]` (document page — Cuprins TOC + inline Stenograma body that groups speeches under each agenda item in `position_in_document` order; ISR 1h, JSON-LD `Article` + `GovernmentService`), `/mo/[year]/[part]/[issue]/pdf` (route handler — 302-redirects to a 5-min SigV4-presigned R2 URL; `force-dynamic`, hidden when `S3_*` env vars aren't set; see "PDF rule" below), `/politicieni/[slug]` (person profile — mandates + per-year speech sparkbar + 53-week activity heatmap (calendar year, defaults to year of `last_speech_date`, switchable via `?year=YYYY`; non-empty cells link to `?day=YYYY-MM-DD` which narrows the speeches list below to that single day) + recent speeches via `personPage(slug, { year, day })`, ISR 1h, JSON-LD `Person`; `?year=` and `?day=` are non-canonical — `alternates.canonical` always points at the bare URL), `/cauta` (speech search, `force-dynamic`, `noindex,follow`). Speech blocks link to `/politicieni/<speaker.person_id>` only when `person_id` is non-null — `person_id === slug` (verified against the live `mo-persons` index). Until per-grain detail routes ship, the Cuprins links to in-page anchors (`#agenda-<ord>`) and individual speeches are addressable via `#discurs-<position_in_document>`. Other grain routes ship in subsequent phases.
- **404s**: `src/app/not-found.tsx` is the catch-all (unmatched URLs + any `notFound()` call without a closer match) — it ships search + entry-point wayfinding. Scoped `not-found.tsx` lives next to each dynamic route (`/mo/[year]/[part]/[issue]`, `/politicieni/[slug]`) for in-context messaging when a specific record is missing. All three share the same eyebrow / headline / paragraph / button structure; copy stays in the civic-archive register.

**UI rule (non-negotiable):** before writing any new JSX for an interactive primitive, check `src/components/ui/` and the `@shadcn` registry first. If a shadcn primitive exists, use it — even if you have to wrap it. Hand-rolling is reserved for **signature components** that have no shadcn analogue (e.g. `Dateline`, `StatsRegister`).

- **Already installed** (`src/components/ui/`): `button`, `input`, `input-group` (+ `InputGroupAddon` / `InputGroupInput` / `InputGroupButton` / `InputGroupText`), `kbd` (+ `KbdGroup`), `textarea`, `empty` (reserved for the search-results no-matches page; the document-page agenda absence stays as a quiet inline note, not an `Empty` block — see DESIGN.md "no illustrations" Don't).
- **Likely needed soon** — install with `bunx --bun shadcn@latest add <name>`: `card`, `badge`, `separator`, `skeleton`, `table`, `tabs`, `dropdown-menu`, `tooltip`, `select`, `breadcrumb`, `field`, `pagination`, `popover`, `dialog`.
- **Workflow:** run the `add` command. **When prompted to overwrite an existing file, decline (`n`)** — the existing file in this repo has been adjusted to project conventions and overwriting destroys those edits. The CLI may still install transitive deps you didn't ask for (e.g. `input-group` pulls in `textarea`); that's fine.
- **Style:** `components.json` pins `"style": "radix-lyra"` and `"baseColor": "neutral"`. Generated components import `Slot` from `radix-ui` (the umbrella package), not `@radix-ui/react-slot`. Don't switch styles.
- **When NOT to use a shadcn primitive:** purely typographic / editorial constructs that _are_ the design system's signature voice — `Dateline`, the landing's typeset register, mono uppercase labels (`label-mono` is a CSS class, not a component). These belong in `src/components/`, not in `src/components/ui/`.
- **Tokens:** every shadcn primitive must read from the project's tokens (`paper-99`, `paper-96`, `paper-91`, `ink-16`, `ink-30`, `ink-45`, `azure-3`, `alert-civic`) via the existing semantic aliases (`bg-background`, `border-input`, `text-foreground`, etc.) which `globals.css` maps onto our scale. Don't hardcode hex / oklch values inside components.

**ES rule:** every read goes through [`src/lib/search.ts`](src/lib/search.ts). No direct `@elastic/elasticsearch` calls in pages or route handlers. Function set mirrors the upstream `monitorul_ii.elasticsearch.queries` module and inherits its caps (`pageSize ≤ 50`, `isSubstantive=true` default). Grain shapes live in [`src/lib/types.ts`](src/lib/types.ts); the deeper field-by-field reference is [`docs/architecture.md`](docs/architecture.md). Self-hosted ES with self-signed cert is the default — `ES_VERIFY_CERTS=1` only when the cluster has a public chain.

**Search rule:** `searchSpeeches` defaults to `rankFusion: "rrf"` — hybrid BM25 + kNN over `enrichments.embedding` (1024-dim BGE-M3), fused client-side via Reciprocal Rank Fusion (Σ 1/(60 + rank)). The BM25 leg fans out across `SPEECH_SEARCH_FIELDS` — main fields (`text^2` / `agenda_title^1.5` / `speaker.name_search`) paired with their `.folded` subfields at lower boosts so a query like `sosoaca` matches indexed `șoșoacă` via `text.folded` while diacritic-correct queries still rank exact matches first; the highlighter uses `matched_fields` so snippets render either way. Vector comes from the embed provider selected by `EMBED_PROVIDER` (see [`src/lib/embed.ts`](src/lib/embed.ts)): `local` calls the FastAPI service at `EMBED_URL` (monitorul-ii box, dev default); `cloud` calls any OpenAI-compatible `/v1/embeddings` endpoint at `EMBED_CLOUD_URL` with `Authorization: Bearer $EMBED_CLOUD_TOKEN` for the `EMBED_CLOUD_MODEL` model (default `bge-m3`; used on Vercel). Toggle by flipping `EMBED_PROVIDER` in `.env.local`; both sets of creds can stay populated. Silent BM25 fallback when: query is empty, embed service unreachable, user is past the fusion pool depth (~10 pages), or BM25 returns zero hits (gates out kNN hallucination on nonsense queries — pre-fix the no-diacritic case `sosoaca` would hit this gate; post-fix `text.folded` rescues it). Mode is surfaced on `/cauta` as a `Hibrid` / `BM25` chip next to the took-ms timing. Native ES `retrievers.rrf` is Platinum-licensed and not used.

**Env rule:** read env vars from [`src/env.ts`](src/env.ts) (validated by `@t3-oss/env-nextjs` + Zod). Never use `process.env.*` directly in app code. To add a new var: declare it in `src/env.ts` (server / client / shared), add it to `.env.example`, and import `env` where needed. `next.config.ts` imports the module so `next dev` / `next build` fail fast on missing or malformed values; `SKIP_ENV_VALIDATION=1` bypasses for lint-only CI.

**PDF rule:** original PDFs live in a PRIVATE Cloudflare R2 bucket (S3-compatible, see `S3_*` env vars). The bucket is never exposed to the browser — [`src/lib/pdf.ts`](src/lib/pdf.ts) derives the bucket key from the indexed `MoDocument` (`{published}_MO-P{part}-{issue}-{year}.pdf`, the shape minted upstream by the monitorul-ii scraper) and uses `aws4fetch` to mint short-lived (5 min) SigV4-presigned GET URLs server-side. The `/mo/[year]/[part]/[issue]/pdf` route handler 302-redirects to that signed URL; signing keys never reach the client. The PDF link on document pages is hidden when the bucket isn't configured or the document has no `published` date. Per-request signing is intentional (caching the redirect would also cache an expiring signature); the cost is microseconds.

## Code Quality

**After meaningful feature changes, update `README.md` (user-facing), `CLAUDE.md` (this file but keep it concise), and `docs/architecture.md` (deep dives).** "Meaningful" = a new feature, a new behavior or default, a new module / page / route, a new external dependency, or anything a future user/agent would otherwise have to read the diff to discover. Trivial bug fixes and pure refactors don't need a doc update. **Keep CLAUDE.md scannable** — push detailed mechanics into `docs/architecture.md` and link from here.

```bash
bun run fmt
bun run lint
bun run typecheck
```

Fix every issue surfaced by any of the three — including oxlint warnings in files you authored. Do not leave a task in a state where `bun run lint` or `bun run typecheck` reports errors.

## Release flow

Releases are managed by **release-please** via `.github/workflows/release-please.yml` (config: `release-please-config.json`, manifest: `.release-please-manifest.json`). Use Conventional Commits so the action can compute version bumps.
