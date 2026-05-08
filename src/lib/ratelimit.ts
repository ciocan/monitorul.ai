import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/env";

// Per-IP sliding-window rate limiters for the public MCP route. Two tiers:
//
//   - `general` — every tool call. Loose enough for legitimate multi-step
//     LLM exchanges (a bursty 30/min chain is normal).
//
//   - `heavy` — RRF / kNN-only `search_speeches`. Each call hits the embed
//     service and runs two ES queries; cap individual abusers at 6/min so a
//     single client can't melt the embed pool.
//
// Both keys collapse anonymous IPs (no headers) onto a single shared bucket
// so the limiter can't be bypassed by stripping `x-forwarded-for`. When the
// Upstash env vars aren't set, both limiters short-circuit to "always allow"
// — convenient for local dev. Production deploys MUST set both vars.

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
    limiter: Ratelimit.slidingWindow(6, "1 m"),
    prefix: "mcp:heavy",
    analytics: false,
  });
  return cachedHeavy;
}

// Header precedence:
//   1. `cf-connecting-ip` — Cloudflare proxy (V2 plan keeps Vercel as origin
//      with CF as the DNS-proxied front).
//   2. `x-forwarded-for` — Vercel sets this on every incoming request. We
//      take the first hop (the public client), not the last.
//   3. Anonymous bucket — collapses every request without identifiable
//      headers onto a shared "anon" key; otherwise an attacker could strip
//      headers to bypass the limiter.
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
