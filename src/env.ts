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
    EMBED_URL: z.url().optional(),
    // Best-effort write of search telemetry to monitorul_query_log. Off unless "1".
    QUERY_LOG_WRITE: z
      .string()
      .optional()
      .transform((v) => v === "1"),
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
