import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    ES_URL: z.url(),
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
