import { defineConfig } from "drizzle-kit";

// drizzle-kit reads the *direct* Neon URL (no pgbouncer) so migration DDL
// commands (DROP TABLE, CREATE INDEX CONCURRENTLY, etc.) work end-to-end.
// The runtime client in `src/lib/auth.ts` uses the pooler URL instead.
//
// Env loading: drizzle-kit auto-loads `.env`. Run via Bun
// (`bun --env-file=.env.local --bun drizzle-kit ...`) to pick up the
// project's `.env.local` instead.
const url = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "drizzle.config.ts: set DATABASE_DIRECT_URL (preferred) or DATABASE_URL in your env",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  // Better Auth's CLI emits singular table names (user, session, account,
  // verification, oauthApplication, oauthAccessToken, oauthConsent, jwks).
  // Keep the same convention here.
  casing: "snake_case",
});
