"use client";

import { useEffect } from "react";

import { env } from "@/env";
import { flushAnalyticsQueue } from "@/lib/analytics";
import { installPostHogScriptAliases } from "@/lib/posthog-shim";

// Module-level guard: posthog.init() is technically idempotent but
// re-invoking it during React StrictMode's double-effect dev pass spams
// the console. The flag survives the second invocation cleanly.
let initialized = false;

// PostHog Cloud EU bootstrap. The init options below are a published privacy
// commitment — they are explicitly disclosed on `/confidentialitate` and
// pinned in CLAUDE.md → "Analytics rule". Any PR that loosens any setting
// here must also update the privacy notice in the same PR.
//
// When `NEXT_PUBLIC_POSTHOG_KEY` is unset, init is skipped entirely — the
// site builds and runs without PostHog wired in, and `track*` calls in
// `src/lib/analytics.ts` become no-ops. Effectively the kill-switch.
//
// posthog-js is loaded via dynamic import so this module's static import
// graph stays free of it. That keeps Turbopack's HMR detector from picking
// up PostHog's runtime side-effects during dev (extension loading, /decide
// fetches) as "module changed" and looping Fast Refresh.
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (initialized) return;
    initialized = true;

    void (async () => {
      const { default: posthog } = await import("posthog-js");
      // Make the instance visible to `src/lib/analytics.ts` (which reads
      // `window.posthog` rather than statically importing posthog-js, to
      // keep the SDK out of RSC server bundles). posthog-js auto-exposes
      // itself, but assigning explicitly is the documented contract.
      window.posthog = posthog;
      installPostHogScriptAliases();
      posthog.init(key, {
        api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
        defaults: "2026-01-30",
        // No persistent state. Each tab is an island; closing the tab erases
        // all PostHog state. No cookies, no localStorage, no sessionStorage
        // with stable IDs.
        persistence: "memory",

        // Never create a person profile. Events stay anonymous-aggregate
        // forever. Even authenticated MCP users stay anonymous in PostHog —
        // their user_id lives only in mo_query_log on Postgres.
        person_profiles: "never",

        // No autocapture — clicks / scrolls / form-submits never fire
        // events of their own; every interaction we care about is wrapped
        // in a typed tracker.
        autocapture: false,

        // Auto-fire `$pageview` on first load AND on every history-change
        // (Next.js soft-nav). This is the event PostHog Web Analytics and
        // most default insights consume; without it those dashboards stay
        // empty even though our typed events stream into the Activity feed
        // and any custom insight built on them. Disclosure on
        // /confidentialitate already covers "evenimente anonime de pagină"
        // — URL + referrer + time — so this doesn't change the privacy
        // contract; it just lets PostHog read the data we were already
        // collecting via custom events.
        capture_pageview: "history_change",
        capture_pageleave: false,

        // No DOM recordings under any circumstance.
        disable_session_recording: true,

        // No surveys, no feature flags, no experiments unless explicitly
        // enabled later (each would need its own privacy-notice review).
        disable_surveys: true,

        // Honor Do Not Track. Browsers that set DNT get zero events.
        respect_dnt: true,

        // In production keep PostHog's built-in bot-user-agent filter on
        // (the default — `false` here means "do not opt out of the filter",
        // i.e. filter is active). In development flip the opt-out so a
        // HeadlessChrome smoke test (or a developer's own browser) can
        // actually push events; otherwise dev events are silently dropped
        // and the integration looks broken.
        opt_out_useragent_filter: env.NODE_ENV === "development",

        // Send /e/ payloads uncompressed in development so smoke tests can
        // read the request body without gzip-decoding. Production keeps the
        // default gzip-js path (smaller payload, no DevTools introspection
        // need).
        disable_compression: env.NODE_ENV === "development",

        // Skip the /decide endpoint (feature-flag + autocapture-config
        // bootstrap) and the lazy-loaded recording / toolbar / surveys
        // modules. We use none of those features; their network + DOM
        // side-effects were causing Turbopack to loop Fast Refresh in dev.
        advanced_disable_flags: true,
        advanced_disable_feature_flags: true,
        disable_external_dependency_loading: true,

        // Defense in depth — autocapture is off but masking is cheap.
        mask_all_text: false,
        mask_all_element_attributes: false,
      });
      // Drain any events that fired between page mount and the moment
      // posthog-js finished loading.
      flushAnalyticsQueue();
    })();
  }, []);

  return <>{children}</>;
}
