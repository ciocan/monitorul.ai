import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

// Per-request context shared between the route handler entry point and the
// downstream lib layer. Two consumers today:
//
//   - `mcp-adapters.ts` reads `origin` to render absolute URLs that match
//     the host the client is actually hitting (instead of the build-time
//     `NEXT_PUBLIC_SITE_URL` default).
//
//   - `search.ts.logQuery` reads `surface` and `tool` to label each row in
//     `mo_query_log` with which entry point fired the call (web page,
//     MCP server, or the legacy `/api/search/persons` route). Without
//     these labels, traffic from the three surfaces is indistinguishable
//     and per-surface analytics aren't possible.
//
// Pattern: route handler captures whatever it knows up front and runs the
// downstream chain inside `requestContext.run(...)`. Anything not provided
// stays undefined; consumers fall back to neutral defaults.

export type RequestSurface = "web" | "mcp" | "api";

export interface RequestContext {
  // Public-facing origin (e.g. `https://monitorul.ai`, `http://localhost:3020`).
  // Derived by the route handler from `X-Forwarded-Host` / `X-Forwarded-Proto`
  // (or the `Host` header in plain dev). Falls back to `NEXT_PUBLIC_SITE_URL`
  // in code paths without a Request (tests, server-side usage).
  origin?: string;
  // Which entry point fired this call. Set by the route handler that owns
  // the surface; absent for code paths that don't go through one (RSC pages,
  // build-time prerender). The query log treats absent as `web`.
  surface?: RequestSurface;
  // For `surface === "mcp"`, the tool name the LLM invoked
  // (`search_speeches`, `describe_corpus`, …). Lets us count tool-call
  // frequency without joining on op + args.
  tool?: string;
  // For `surface === "mcp"`, the Better Auth user ID owning the bearer
  // token. Stamped onto every `mo_query_log` row so abuse + per-user
  // analytics can attribute traffic. Always populated on the MCP surface
  // (the route is auth-gated); absent on web / api surfaces today.
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
