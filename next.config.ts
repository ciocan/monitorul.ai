import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Validate env at config-load time so `next dev` / `next build` fail fast on
// missing or malformed vars rather than at the first request.
import { env } from "./src/env";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  allowedDevOrigins: env.ALLOWED_DEV_ORIGINS,
  // `pg` (node-postgres, used by Drizzle in `src/lib/auth.ts`) and `pg-cloudflare`
  // (its WebSocket fallback) ship native bindings that Turbopack mangles when it
  // tries to bundle them. Listing them as server externals keeps them as Node
  // imports at runtime, which is what they expect.
  serverExternalPackages: ["pg", "pg-cloudflare"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
