import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/env";

// Sliding-window rate limiters for the auth-gated MCP route. Defense in
// depth across two axes:
//
//   - **Per-IP** (`generalLimiter`, `heavyLimiter`) — protects against a
//     single network origin (botnet node, scraper, single token leaked
//     across many clients) overwhelming the route, regardless of which
//     user account is in play.
//
//   - **Per-user** (`userLimiter`, `userHeavyLimiter`) — protects against
//     a single account spreading abuse across rotating IPs (cloud
//     functions, residential proxies). Bound to the Better Auth `userId`
//     supplied by `withMcpAuth`.
//
// Each axis has two tiers:
//
//   - `general` (30/min) — every tool call.
//   - `heavy`   (20/min) — RRF / kNN-only `search_speeches`. Each call hits
//     the embed service and runs two ES queries; tighter per-IP and
//     per-user caps stop a single actor from melting the embed pool.
//
// Both axes must clear for a request to proceed; either 429 short-circuits.
// When the Upstash env vars aren't set, all limiters short-circuit to
// "always allow" — convenient for local dev. Production deploys MUST set
// both vars.

interface RateLimitDecision {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

interface RateLimiter {
  limit: (key: string) => Promise<RateLimitDecision>;
}

const ALWAYS_ALLOW: RateLimiter = {
  limit: async () => ({
    success: true,
    remaining: Number.POSITIVE_INFINITY,
    reset: 0,
    limit: Number.POSITIVE_INFINITY,
  }),
};

let cachedRedis: Redis | null = null;
let cachedGeneral: RateLimiter | null = null;
let cachedHeavy: RateLimiter | null = null;
let cachedUserGeneral: RateLimiter | null = null;
let cachedUserHeavy: RateLimiter | null = null;

function redis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (cachedRedis) return cachedRedis;
  cachedRedis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return cachedRedis;
}

export function generalLimiter(): RateLimiter {
  if (cachedGeneral) return cachedGeneral;
  const r = redis();
  if (!r) {
    cachedGeneral = ALWAYS_ALLOW;
    return cachedGeneral;
  }
  cachedGeneral = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "mcp:general",
    analytics: false,
  });
  return cachedGeneral;
}

export function heavyLimiter(): RateLimiter {
  if (cachedHeavy) return cachedHeavy;
  const r = redis();
  if (!r) {
    cachedHeavy = ALWAYS_ALLOW;
    return cachedHeavy;
  }
  cachedHeavy = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "mcp:heavy",
    analytics: false,
  });
  return cachedHeavy;
}

export function userLimiter(): RateLimiter {
  if (cachedUserGeneral) return cachedUserGeneral;
  const r = redis();
  if (!r) {
    cachedUserGeneral = ALWAYS_ALLOW;
    return cachedUserGeneral;
  }
  cachedUserGeneral = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "mcp:user-general",
    analytics: false,
  });
  return cachedUserGeneral;
}

export function userHeavyLimiter(): RateLimiter {
  if (cachedUserHeavy) return cachedUserHeavy;
  const r = redis();
  if (!r) {
    cachedUserHeavy = ALWAYS_ALLOW;
    return cachedUserHeavy;
  }
  cachedUserHeavy = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "mcp:user-heavy",
    analytics: false,
  });
  return cachedUserHeavy;
}

// Header precedence:
//   1. `cf-connecting-ip` — Cloudflare proxy (V2 plan keeps Vercel as origin
//      with CF as the DNS-proxied front).
//   2. `x-forwarded-for` — Vercel sets this on every incoming request. We
//      take the first hop (the public client), not the last.
//   3. Anonymous bucket — collapses every request without identifiable
//      headers onto a shared "anon" key; otherwise an attacker could strip
//      headers to bypass the limiter. The MCP route is auth-gated so this
//      mostly catches misconfigured proxies, not real anonymous traffic.
export function ipFromRequest(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff?.trim()) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "anon";
}
