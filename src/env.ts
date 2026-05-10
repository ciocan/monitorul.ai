import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    // One or more ES node URLs, comma-separated. The Node.js client load-
    // balances across them with round-robin by default and takes a dead node
    // out of rotation for ~60s on connection failure.
    ES_URL: z
      .string()
      .min(1)
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    ES_API_KEY: z.string().min(1),
    // Self-hosted ES (default monitorul-ii box) ships a self-signed cert; cert
    // verification is opt-in via "1" (e.g. against managed ES with a public chain).
    ES_VERIFY_CERTS: z
      .string()
      .optional()
      .transform((v) => v === "1"),
    // Embed provider switch. `local` calls the FastAPI service at EMBED_URL
    // (default for dev against the monitorul-ii box). `cloud` calls a hosted
    // OpenAI-compatible /v1/embeddings endpoint — the path used on Vercel,
    // where the local embedder is unreachable. Toggle by flipping this var
    // in .env.local; per-provider creds can stay populated either way.
    EMBED_PROVIDER: z.enum(["local", "cloud"]).default("local"),
    EMBED_URL: z.url().optional(),
    EMBED_CLOUD_URL: z.url().optional(),
    EMBED_CLOUD_TOKEN: z.string().min(1).optional(),
    // Model id sent in the OpenAI-compatible payload. Stays bge-m3 because the
    // index's `enrichments.embedding` is BGE-M3 (1024-dim); changing this
    // silently breaks similarity. Override only if your provider names the
    // same BGE-M3 weights differently (e.g. `BAAI/bge-m3`).
    EMBED_CLOUD_MODEL: z.string().min(1).default("bge-m3"),
    // Best-effort write of search telemetry to monitorul_query_log. Off unless "1".
    QUERY_LOG_WRITE: z
      .string()
      .optional()
      .transform((v) => v === "1"),
    // S3-compatible storage for the original artefacts (PDF / MD / sidecar).
    // Cloudflare R2 is the production target — point S3_ENDPOINT at the R2
    // hostname (`https://<account>.r2.cloudflarestorage.com`) and SigV4 just
    // works. The bucket itself stays PRIVATE: app-side reads go through the
    // presigner in `src/lib/pdf.ts`, which mints short-lived (5 min) signed
    // URLs server-side; access keys never leave the server. All four are
    // optional so search-only deploys can run without storage creds — the
    // PDF button on /mo/* pages is hidden when they're missing.
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().default("auto"),
    // Upstash Redis for MCP rate limiting (Phase 8). Both vars are optional so
    // the MCP route can run unrate-limited in dev without external services;
    // when one is present the other must also be present (validated below).
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // Comma-separated host(s) allowed by `next dev` for cross-origin asset
    // requests (LAN IPs, ngrok, etc.). Dev-only; ignored by `next build`.
    ALLOWED_DEV_ORIGINS: z
      .string()
      .optional()
      .transform((v) =>
        v
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      ),
    // Neon Postgres for Better Auth's user / session / OAuth tables. The
    // `DATABASE_URL` is the pooler URL (`-pooler.neon.tech`) used by Vercel
    // functions at runtime — short-lived, pgbouncer-fronted. The
    // `DATABASE_DIRECT_URL` is the same branch's direct URL, used by
    // `drizzle-kit` for migrations from the laptop (pooler doesn't support
    // every command drizzle-kit emits). Both required: drizzle-kit reads
    // `DATABASE_DIRECT_URL`, the runtime client reads `DATABASE_URL`.
    DATABASE_URL: z.url(),
    DATABASE_DIRECT_URL: z.url(),
    // Better Auth signing key (HS256 for sessions + JWT bearer tokens).
    // 32-byte hex, generated via `openssl rand -hex 32`. Rotation
    // invalidates all refresh tokens — users re-auth on next call.
    BETTER_AUTH_SECRET: z.string().min(32),
    // Public-facing Better Auth base URL. Drives the OAuth issuer claim
    // and the cookie domain. `https://monitorul.ai` in prod, the Vercel
    // preview URL on `*.vercel.app`, `http://localhost:3020` locally.
    BETTER_AUTH_URL: z.url(),
    // Google OAuth client (one per environment — prod and dev clients
    // configured separately in Google Cloud Console). The MCP plugin's DCR
    // flow does NOT use these directly; they back the social-provider
    // sign-in that the OAuth-consent flow eventually delegates to.
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    // Stripe Payment Links (configured in the Stripe dashboard with custom-amount
    // enabled). The /sustine page links directly — no server-side Stripe SDK,
    // no API route, no webhook. Both optional: when unset, the contribute
    // buttons render as a disabled "Disponibil în curând" state so the page
    // builds and dev runs without Stripe set up.
    STRIPE_PAYMENT_LINK_MONTHLY: z.url().optional(),
    STRIPE_PAYMENT_LINK_ONESHOT: z.url().optional(),
    // Public IBAN printed on /sustine as the second payment rail. All four
    // optional: the IBAN block hides entirely when SUSTINE_IBAN is unset.
    // Account name should match the registered legal name of the receiving
    // entity (the UK Ltd) — readers cross-reference this against Companies
    // House when verifying the entity.
    SUSTINE_IBAN: z.string().min(1).optional(),
    SUSTINE_BIC: z.string().min(1).optional(),
    SUSTINE_ACCOUNT_NAME: z.string().min(1).optional(),
    SUSTINE_BANK_NAME: z.string().min(1).optional(),
    // Contact email for invoice requests, MCP rate-limit raises, and other
    // /sustine questions. When unset, the "Întrebări" section omits the
    // address — the page still builds.
    SUSTINE_CONTACT_EMAIL: z.email().optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default("https://monitorul.ai"),
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  // Next.js >= 13.4.4 statically replaces `process.env.NEXT_PUBLIC_*` at build
  // time, so only client + shared keys need to be listed here.
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  // Treat `KEY=` (empty string) as undefined so optional vars and defaults work.
  emptyStringAsUndefined: true,
  // Escape hatch for CI (release-please, lint-only runs) where ES is unreachable.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
