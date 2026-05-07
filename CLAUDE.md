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
- **Fonts** are loaded in `src/app/layout.tsx` via `next/font/google` and exposed as CSS variables: `--font-sans` (Figtree), `--font-heading` (Noto Sans), `--font-geist-sans`, `--font-geist-mono`. Match those variable names when adding theme tokens in `globals.css`.

**UI rule:** always reach for a shadcn primitive (`button`, `input`, `card`, `data-table`-pattern via `table` + `@tanstack/react-table`, `dropdown-menu`, `tabs`, `tooltip`, `badge`, `select`, `separator`, `skeleton`, …) before hand-rolling a component. `bunx --bun shadcn@latest add <name>` to install one.

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
