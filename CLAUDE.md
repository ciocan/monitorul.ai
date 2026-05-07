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
- **Routes (Next.js 16 App Router)**: `/` (landing, ISR 1h, archive stats register), `/mo/[year]/[part]/[issue]` (document page, ISR 1h, JSON-LD `Article` + `GovernmentService`), `/cauta` (speech search, `force-dynamic`, `noindex,follow`). Other grain routes ship in subsequent phases.

**UI rule (non-negotiable):** before writing any new JSX for an interactive primitive, check `src/components/ui/` and the `@shadcn` registry first. If a shadcn primitive exists, use it — even if you have to wrap it. Hand-rolling is reserved for **signature components** that have no shadcn analogue (e.g. `Dateline`, `StatsRegister`).

- **Already installed** (`src/components/ui/`): `button`, `input`, `input-group` (+ `InputGroupAddon` / `InputGroupInput` / `InputGroupButton` / `InputGroupText`), `kbd` (+ `KbdGroup`), `textarea`, `empty` (reserved for the search-results no-matches page; the document-page agenda absence stays as a quiet inline note, not an `Empty` block — see DESIGN.md "no illustrations" Don't).
- **Likely needed soon** — install with `bunx --bun shadcn@latest add <name>`: `card`, `badge`, `separator`, `skeleton`, `table`, `tabs`, `dropdown-menu`, `tooltip`, `select`, `breadcrumb`, `field`, `pagination`, `popover`, `dialog`.
- **Workflow:** run the `add` command. **When prompted to overwrite an existing file, decline (`n`)** — the existing file in this repo has been adjusted to project conventions and overwriting destroys those edits. The CLI may still install transitive deps you didn't ask for (e.g. `input-group` pulls in `textarea`); that's fine.
- **Style:** `components.json` pins `"style": "radix-lyra"` and `"baseColor": "neutral"`. Generated components import `Slot` from `radix-ui` (the umbrella package), not `@radix-ui/react-slot`. Don't switch styles.
- **When NOT to use a shadcn primitive:** purely typographic / editorial constructs that _are_ the design system's signature voice — `Dateline`, the landing's typeset register, mono uppercase labels (`label-mono` is a CSS class, not a component). These belong in `src/components/`, not in `src/components/ui/`.
- **Tokens:** every shadcn primitive must read from the project's tokens (`paper-99`, `paper-96`, `paper-91`, `ink-16`, `ink-30`, `ink-45`, `azure-3`, `alert-civic`) via the existing semantic aliases (`bg-background`, `border-input`, `text-foreground`, etc.) which `globals.css` maps onto our scale. Don't hardcode hex / oklch values inside components.

**ES rule:** every read goes through [`src/lib/search.ts`](src/lib/search.ts). No direct `@elastic/elasticsearch` calls in pages or route handlers. Function set mirrors the upstream `monitorul_ii.elasticsearch.queries` module and inherits its caps (`pageSize ≤ 50`, `isSubstantive=true` default). Grain shapes live in [`src/lib/types.ts`](src/lib/types.ts); the deeper field-by-field reference is [`docs/architecture.md`](docs/architecture.md). Self-hosted ES with self-signed cert is the default — `ES_VERIFY_CERTS=1` only when the cluster has a public chain.

**Search rule:** `searchSpeeches` defaults to `rankFusion: "rrf"` — hybrid BM25 + kNN over `enrichments.embedding` (1024-dim BGE-M3), fused client-side via Reciprocal Rank Fusion (Σ 1/(60 + rank)). Vector comes from the local embedder service at `EMBED_URL` (see [`src/lib/embed.ts`](src/lib/embed.ts)). Silent BM25 fallback when: query is empty, embed service unreachable, user is past the fusion pool depth (~10 pages), or BM25 returns zero hits (gates out kNN hallucination on nonsense queries). Mode is surfaced on `/cauta` as a `Hibrid` / `BM25` chip next to the took-ms timing. Native ES `retrievers.rrf` is Platinum-licensed and not used.

**Env rule:** read env vars from [`src/env.ts`](src/env.ts) (validated by `@t3-oss/env-nextjs` + Zod). Never use `process.env.*` directly in app code. To add a new var: declare it in `src/env.ts` (server / client / shared), add it to `.env.example`, and import `env` where needed. `next.config.ts` imports the module so `next dev` / `next build` fail fast on missing or malformed values; `SKIP_ENV_VALIDATION=1` bypasses for lint-only CI.

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
