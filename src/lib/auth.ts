import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { mcp } from "better-auth/plugins";

import { env } from "@/env";

import { db, schema } from "./db/client";

// Better Auth backed by Neon Postgres via the Drizzle adapter. Backs three
// surfaces:
//
//   - The web sign-in flow at `/cont` — Google OAuth → Better Auth user row.
//   - The MCP OAuth dance — DCR + PKCE + browser consent, gated by
//     `withMcpAuth(auth, ...)` in `src/app/mcp/server/route.ts`.
//   - The `.well-known` discovery routes that point any compliant MCP client
//     at this issuer.
//
// The runtime client uses the Neon pooler URL (`-pooler.neon.tech`); short
// Vercel function lifetimes mean we cap the pool at 1 and rely on pgbouncer
// upstream to multiplex. drizzle-kit reads `DATABASE_DIRECT_URL` for
// migrations — see `drizzle.config.ts`.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // Single social provider for V1 — open self-serve onboarding via Google.
  // Other providers (GitHub, magic-link) are deferred per the auth handoff.
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    // The MCP plugin owns the streamable-HTTP-flavoured OAuth surface:
    // /.well-known/oauth-protected-resource, /.well-known/oauth-authorization-server,
    // /mcp/register (DCR), /mcp/authorize, /mcp/token, /oauth2/consent.
    // `loginPage` is where the flow redirects a user who isn't signed in;
    // `consentPage` is the themed in-house consent screen the user sees
    // after sign-in, before authorising the AI client. Both stay in
    // Romanian under the `/cont/*` namespace so the auth surface reads as
    // one coherent area in the masthead.
    mcp({
      loginPage: "/cont/intra",
      // RFC 9728 + MCP 2025-06-18 §3.1 require the protected-resource doc's
      // `resource` field to equal the canonical URL of the MCP endpoint, not
      // just the origin. Better Auth defaults to origin; some clients
      // (claude.ai's MCP integration in particular) reject the discovery as
      // invalid when it doesn't match the actual MCP URL — the token row
      // gets created during the OAuth dance, but the very first call to
      // `/mcp/server` is rejected client-side and surfaces as
      // "Authorization with the MCP server failed".
      resource: `${env.BETTER_AUTH_URL}/mcp/server`,
      oidcConfig: {
        // Mirrored only because the OIDCOptions type marks `loginPage` as
        // required; the MCP plugin overrides this internally with the
        // outer `loginPage` (see `node_modules/better-auth/dist/plugins/mcp/index.mjs`).
        loginPage: "/cont/intra",
        consentPage: "/cont/consimt",
      },
    }),
    // `nextCookies` MUST be last. Intercepts auth responses on Server
    // Actions and re-issues their `Set-Cookie` headers via Next.js's
    // `cookies()` API. Without it, Server Actions calling `auth.api.*`
    // return cookies the framework can't propagate.
    nextCookies(),
  ],
  // Project-scoped cookie prefix. Default is `better-auth.<name>`; we use
  // `mo.<name>` so cookies inspected in DevTools read as monitorul.ai's,
  // not generic Better Auth ones. Production cookies are auto-marked Secure
  // because Better Auth detects HTTPS via `baseURL`.
  advanced: {
    cookiePrefix: "mo",
  },
});

export type Auth = typeof auth;
