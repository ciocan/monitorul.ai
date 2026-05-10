import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
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
  //
  async rewrites() {
    return [
      {
        source: "/trace/static/r.js",
        destination: "https://eu-assets.i.posthog.com/static/recorder.js",
      },
      {
        source: "/trace/static/d.js",
        destination: "https://eu-assets.i.posthog.com/static/dead-clicks-autocapture.js",
      },
      {
        source: "/trace/static/x.js",
        destination: "https://eu-assets.i.posthog.com/static/exception-autocapture.js",
      },
      {
        source: "/trace/static/su.js",
        destination: "https://eu-assets.i.posthog.com/static/surveys.js",
      },
      {
        source: "/trace/static/w.js",
        destination: "https://eu-assets.i.posthog.com/static/web-vitals.js",
      },
      {
        source: "/trace/static/tb.js",
        destination: "https://eu-assets.i.posthog.com/static/toolbar.js",
      },
      {
        source: "/trace/static/h.js",
        destination: "https://eu-assets.i.posthog.com/static/tracing-headers.js",
      },
      {
        source: "/trace/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/trace/decide",
        destination: "https://eu.i.posthog.com/decide",
      },
      {
        source: "/trace/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
};

const withMDX = createMDX({});

// `withBotId` installs proxy rewrites at obfuscated paths so ad-blockers
// can't kneecap the BotID challenge. MDX runs first (config-closer layer).
export default withBotId(withMDX(nextConfig));
