"use client";

import { useEffect, useRef } from "react";

import {
  classifySpeechSource,
  trackAccountViewed,
  trackCommitteeViewed,
  trackConsentViewed,
  trackDiscourseFilterApplied,
  trackDocumentViewed,
  trackHomeViewed,
  trackIbanRevealed,
  trackLegalViewed,
  trackMcpLandingViewed,
  trackMethodologyViewed,
  trackNotFoundViewed,
  trackPersonPageViewed,
  trackRegisterViewed,
  trackSigninViewed,
  trackSpeechViewed,
  trackSustineViewed,
  trackYearSelectorChanged,
  type AccountViewedProps,
  type CommitteeViewedProps,
  type ConsentViewedProps,
  type DiscourseFilterAppliedProps,
  type DocumentViewedProps,
  type LegalViewedProps,
  type MethodologyViewedProps,
  type NotFoundViewedProps,
  type PersonPageViewedProps,
  type RegisterViewedProps,
  type SigninViewedProps,
  type SpeechViewedProps,
  type SustineViewedProps,
  type YearSelectorChangedProps,
} from "@/lib/analytics";
import { env } from "@/env";

// One-shot mount trackers — RSC pages render these with the static props
// they already computed for the page; the client component fires the event
// once per page render. Each event has its own component so the call sites
// stay self-documenting (`<SpeechViewedTracker />` is searchable).

// `source` is derived on the client from `document.referrer`, so the page
// passes the static props only. Setting `source` server-side via the
// `Referer` header would leak the referer into the SSR cache — keep it client.
//
// Each tracker uses `useEffect(..., [])` to fire once per page render;
// the props object is freshly constructed on every render but the
// underlying values are stable across the page's lifetime.
export function SpeechViewedTracker(props: Omit<SpeechViewedProps, "source">) {
  useEffect(() => {
    const source = classifySpeechSource(
      typeof document !== "undefined" ? document.referrer : undefined,
      env.NEXT_PUBLIC_SITE_URL,
    );
    trackSpeechViewed({ ...props, source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function PersonPageViewedTracker(props: PersonPageViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackPersonPageViewed(props), []);
  return null;
}

export function DocumentViewedTracker(props: DocumentViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackDocumentViewed(props), []);
  return null;
}

export function CommitteeViewedTracker(props: CommitteeViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackCommitteeViewed(props), []);
  return null;
}

// Funnel-top trackers. The handoff's Dashboard #1 (landing → register →
// record) needs impressions at every step to compute drop-off ratios; the
// per-record events were already wired but the home + register + MCP
// landing impressions weren't. These close that gap.

export function HomeViewedTracker() {
  useEffect(() => trackHomeViewed(), []);
  return null;
}

export function RegisterViewedTracker(props: RegisterViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackRegisterViewed(props), []);
  return null;
}

export function McpLandingViewedTracker() {
  useEffect(() => trackMcpLandingViewed(), []);
  return null;
}

export function SustineViewedTracker(props: SustineViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackSustineViewed(props), []);
  return null;
}

export function NotFoundViewedTracker(props: NotFoundViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackNotFoundViewed(props), []);
  return null;
}

export function MethodologyViewedTracker(props: MethodologyViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackMethodologyViewed(props), []);
  return null;
}

export function LegalViewedTracker(props: LegalViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackLegalViewed(props), []);
  return null;
}

export function SigninViewedTracker(props: SigninViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackSigninViewed(props), []);
  return null;
}

export function ConsentViewedTracker(props: ConsentViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackConsentViewed(props), []);
  return null;
}

export function AccountViewedTracker(props: AccountViewedProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackAccountViewed(props), []);
  return null;
}

// Year sparkbar tracker. Mounts once on the register page; the parent
// re-renders with a new `year` prop after soft-nav (Next 16 keeps client
// components alive across param-only changes). `useRef` carries the previous
// value across renders so we can emit `{ from_year, to_year }` correctly.
//
// First render: previous is null → no event (the user didn't change the year;
// they landed on the page).
export function YearSelectorTracker({
  page,
  year,
}: {
  page: YearSelectorChangedProps["page"];
  year: number;
}) {
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current !== null && prev.current !== year) {
      trackYearSelectorChanged({ page, from_year: prev.current, to_year: year });
    }
    prev.current = year;
  }, [page, year]);
  return null;
}

// IntersectionObserver-based reveal tracker. Fires once when the wrapped
// element enters the viewport. Used for the IBAN block on /sustine to
// measure whether the second contribution rail is being noticed.
export function IbanRevealTracker({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (fired.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            trackIbanRevealed();
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}

// Discourse filter tracker. Mounts on every surface that exposes the
// `voice` / `conf` chips; emits when the URL-derived state changes between
// renders. Same useRef-on-change pattern as YearSelectorTracker — the first
// render seeds the ref without emitting.
export function DiscourseFilterTracker(props: DiscourseFilterAppliedProps) {
  const prev = useRef<DiscourseFilterAppliedProps | null>(null);
  useEffect(() => {
    const last = prev.current;
    if (last && (last.voice !== props.voice || last.confidence !== props.confidence)) {
      trackDiscourseFilterApplied(props);
    }
    prev.current = props;
  }, [props.voice, props.confidence, props]);
  return null;
}
