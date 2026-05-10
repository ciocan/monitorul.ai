// Typed analytics event API. One function per event; every call is a no-op
// when the PostHog provider hasn't initialised (kill-switch via unset
// `NEXT_PUBLIC_POSTHOG_KEY`) or when invoked server-side (v1 is client-only).
//
// The catalogue here mirrors `/confidentialitate` and the
// `docs/_session-handoff-2026-05-10-posthog.md` events register. Any new
// event or property change MUST also update the privacy notice in the same
// PR — the two travel together. See CLAUDE.md → "Analytics rule".
//
// Privacy contract enforced by the type system:
//   - No event captures the query text, document content, speech body, IBAN
//     value, contribution amount, or any other PII / user input verbatim.
//   - No event accepts a person_id or user_id property; PostHog never sees
//     authenticated identity (we never call `posthog.identify`).
//   - Bucketed counts ("0-50", "1-10", ...) defeat low-traffic re-ID even
//     for unique-fingerprint props like document or person rarities.
//
// Implementation note: this module deliberately does NOT statically import
// `posthog-js`. Several RSC pages import pure helpers from here
// (`speechWordCountBucket`, `hasDiacritics`, ...); a static import would
// pull the client-only PostHog SDK into the server bundle and confuse
// Turbopack's HMR detector (Fast-Refresh loop). Instead, `capture()` reads
// `window.posthog`, which the provider in `src/components/posthog-provider.tsx`
// sets after `posthog.init()` runs.

interface PostHogLike {
  capture(name: string, props: Record<string, unknown>): void;
}

declare global {
  interface Window {
    posthog?: PostHogLike;
  }
}

// Pre-init buffer for events that fire before the provider's dynamic import
// of `posthog-js` resolves. Tracker `useEffect`s run synchronously on mount,
// while the provider's `posthog.init()` runs after an async `import()` — so
// the very first batch of page-view events would otherwise be dropped.
// `flushAnalyticsQueue()` is called by the provider once init completes;
// any later capture() call goes straight to `window.posthog`.
const queue: Array<[string, Record<string, unknown>]> = [];

function capture(name: string, props: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const ph = window.posthog;
  if (ph) {
    ph.capture(name, props);
    return;
  }
  queue.push([name, props]);
}

export function flushAnalyticsQueue(): void {
  if (typeof window === "undefined") return;
  const ph = window.posthog;
  if (!ph) return;
  const drained = queue.splice(0);
  for (const [name, props] of drained) {
    ph.capture(name, props);
  }
}

// --- Search ----------------------------------------------------------------

export type SearchPerformedProps = {
  query_length: number;
  query_word_count: number;
  has_diacritics: boolean;
  filter_count: number;
  filter_dimensions: Array<
    "year" | "chamber" | "speaker" | "party" | "procedural" | "date_from" | "date_to"
  >;
  year_count: number;
  sort: "relevance" | "date_desc" | "date_asc";
  result_count: number;
  mode: "hybrid" | "bm25";
  took_ms: number;
  page: number;
};

export function trackSearchPerformed(props: SearchPerformedProps): void {
  capture("search_performed", props);
}

export type SearchResultClickedProps = {
  position: number;
  page: number;
  result_kind: "speech" | "vote" | "interpellation" | "committee_meeting";
  has_speaker: boolean;
  has_discourse: boolean;
  mode: "hybrid" | "bm25";
};

export function trackSearchResultClicked(props: SearchResultClickedProps): void {
  capture("search_result_clicked", props);
}

// --- Page views (autocapture is off — every page view is explicit) ---------
//
// The handoff catalogue covered the per-record surfaces (speech / person /
// document / committee). These three close the funnel-top gaps so the
// landing → register → record dashboard and the MCP funnel have impression
// denominators to ratio against.

export function trackHomeViewed(): void {
  capture("home_viewed", {});
}

export type RegisterViewedProps = {
  register: "mo" | "politicieni" | "comisii" | "statistici";
  // Year context for the rendered register. `null` for `/statistici` when
  // the "all years" filter is active. The pair (year, has_year_filter)
  // tells us "default-year arrival" vs "explicit-year arrival" — useful for
  // measuring how often users hand-pick non-default years.
  year: number | null;
  has_year_filter: boolean;
};

export function trackRegisterViewed(props: RegisterViewedProps): void {
  capture("register_viewed", props);
}

export function trackMcpLandingViewed(): void {
  capture("mcp_landing_viewed", {});
}

export type SustineViewedProps = {
  // Whether the Stripe Payment Links are configured (the page renders
  // active "Contribuie" buttons) or the page is in the "Disponibil în
  // curând" placeholder state. Conversion ratios need this denominator
  // split to be meaningful.
  has_contribute_buttons: boolean;
  has_iban: boolean;
};

export function trackSustineViewed(props: SustineViewedProps): void {
  capture("sustine_viewed", props);
}

export type NotFoundViewedProps = {
  // Which scoped not-found surface rendered: `global` is the root catch-all
  // (`src/app/not-found.tsx`), the others are per-route fallbacks for missing
  // records of that grain.
  kind: "global" | "speech" | "person" | "committee" | "document";
};

export function trackNotFoundViewed(props: NotFoundViewedProps): void {
  capture("not_found_viewed", props);
}

export type MethodologyViewedProps = {
  // Two methodology pages today. Split because they have different audiences:
  // `despre` is the general civic methodology; `despre_discurs` is the
  // discourse-analysis layer.
  page: "despre" | "despre_discurs";
};

export function trackMethodologyViewed(props: MethodologyViewedProps): void {
  capture("methodology_viewed", props);
}

export type LegalViewedProps = {
  page: "confidentialitate" | "termeni";
};

export function trackLegalViewed(props: LegalViewedProps): void {
  capture("legal_viewed", props);
}

export type SigninViewedProps = {
  // Whether the user arrived in the MCP DCR flow (next URL targets
  // /cont/consimt) or as a direct sign-in (e.g. via the header chip).
  // The same page renders both; this property lets the dashboard split
  // the MCP funnel impression from the regular sign-in impression.
  in_oauth_flow: boolean;
};

export function trackSigninViewed(props: SigninViewedProps): void {
  capture("signin_viewed", props);
}

export type ConsentViewedProps = {
  // OAuth client display name — same shape as `mcp_oauth_started` /
  // `mcp_oauth_completed`. Public, not PII. Gives the impression
  // denominator for the consent → accept step in the MCP funnel.
  client_name: string;
};

export function trackConsentViewed(props: ConsentViewedProps): void {
  capture("consent_viewed", props);
}

export type AccountViewedProps = {
  // Bucketed authorized-client count. Coarse-grained so an N=1 user with a
  // specific client_name combination doesn't get re-identified by intersecting
  // properties.
  authorized_client_count_bucket: "0" | "1" | "2-5" | "6+";
};

export function trackAccountViewed(props: AccountViewedProps): void {
  capture("account_viewed", props);
}

export type SpeechViewedProps = {
  has_speaker: boolean;
  has_discourse: boolean;
  is_substantive: boolean;
  word_count_bucket: "0-50" | "50-200" | "200-500" | "500-1000" | "1000+";
  source: "search" | "document" | "person" | "direct" | "external";
};

export function trackSpeechViewed(props: SpeechViewedProps): void {
  capture("speech_viewed", props);
}

export type PersonPageViewedProps = {
  speech_count_bucket: "0" | "1-10" | "10-100" | "100-1000" | "1000+";
  has_year_filter: boolean;
  has_day_filter: boolean;
  page: number;
};

export function trackPersonPageViewed(props: PersonPageViewedProps): void {
  capture("person_page_viewed", props);
}

export type DocumentViewedProps = {
  year: number;
  agenda_item_count: number;
  has_committee_meetings: boolean;
  has_pdf_link: boolean;
};

export function trackDocumentViewed(props: DocumentViewedProps): void {
  capture("document_viewed", props);
}

export type CommitteeViewedProps = {
  meeting_count_bucket: "0" | "1-10" | "10-50" | "50+";
  has_year_filter: boolean;
};

export function trackCommitteeViewed(props: CommitteeViewedProps): void {
  capture("committee_viewed", props);
}

// --- Filters & navigation --------------------------------------------------

export type YearSelectorChangedProps = {
  page: "mo" | "politicieni" | "comisii" | "person";
  from_year: number | null;
  to_year: number;
};

export function trackYearSelectorChanged(props: YearSelectorChangedProps): void {
  capture("year_selector_changed", props);
}

export type FilterAppliedProps = {
  dimension: "year" | "chamber" | "speaker" | "party" | "procedural" | "sort";
  action: "added" | "removed" | "reset_all";
};

export function trackFilterApplied(props: FilterAppliedProps): void {
  capture("filter_applied", props);
}

export type DiscourseFilterAppliedProps = {
  voice: "speaker_first_person" | "all";
  confidence: "all" | "07";
};

export function trackDiscourseFilterApplied(props: DiscourseFilterAppliedProps): void {
  capture("discourse_filter_applied", props);
}

// --- Conversions & external actions ---------------------------------------

export type PdfDownloadInitiatedProps = {
  year: number;
};

export function trackPdfDownloadInitiated(props: PdfDownloadInitiatedProps): void {
  capture("pdf_download_initiated", props);
}

export type ExternalLinkClickedProps = {
  destination: "cdep" | "senat" | "monitoruloficial" | "github" | "stripe" | "other";
  source_page: "home" | "despre" | "sustine" | "footer" | "other";
};

export function trackExternalLinkClicked(props: ExternalLinkClickedProps): void {
  capture("external_link_clicked", props);
}

export type ContributeClickedProps = {
  cadence: "monthly" | "one_off";
  source: "main_button" | "footer";
};

export function trackContributeClicked(props: ContributeClickedProps): void {
  capture("contribute_clicked", props);
}

export function trackIbanRevealed(): void {
  capture("iban_revealed", {});
}

export type SpeechShareLinkCopiedProps = {
  has_anchor: boolean;
};

export function trackSpeechShareLinkCopied(props: SpeechShareLinkCopiedProps): void {
  capture("speech_share_link_copied", props);
}

// --- MCP -------------------------------------------------------------------

export type McpOauthStartedProps = {
  client_name: string;
};

export function trackMcpOauthStarted(props: McpOauthStartedProps): void {
  capture("mcp_oauth_started", props);
}

export type McpOauthCompletedProps = {
  client_name: string;
};

export function trackMcpOauthCompleted(props: McpOauthCompletedProps): void {
  capture("mcp_oauth_completed", props);
}

// --- Helpers --------------------------------------------------------------

// Word-count bucket aligned with `SpeechViewedProps`. Speech length is
// always reported as a coarse bucket — exact word count combined with
// session_date on a low-traffic doc would re-identify the reader.
export function speechWordCountBucket(wordCount: number): SpeechViewedProps["word_count_bucket"] {
  if (wordCount < 50) return "0-50";
  if (wordCount < 200) return "50-200";
  if (wordCount < 500) return "200-500";
  if (wordCount < 1000) return "500-1000";
  return "1000+";
}

export function speechCountBucket(count: number): PersonPageViewedProps["speech_count_bucket"] {
  if (count === 0) return "0";
  if (count < 10) return "1-10";
  if (count < 100) return "10-100";
  if (count < 1000) return "100-1000";
  return "1000+";
}

export function meetingCountBucket(count: number): CommitteeViewedProps["meeting_count_bucket"] {
  if (count === 0) return "0";
  if (count < 10) return "1-10";
  if (count < 50) return "10-50";
  return "50+";
}

const DIACRITICS_RE = /[ăâîșțĂÂÎȘȚ]/;

export function hasDiacritics(s: string): boolean {
  return DIACRITICS_RE.test(s);
}

// Classify the referrer URL into a coarse `SpeechViewedProps["source"]`.
// Same-origin referrers are mapped by pathname prefix; everything else is
// "external" (with `""` and missing referrers reading as "direct").
export function classifySpeechSource(
  referrer: string | undefined,
  siteOrigin: string,
): SpeechViewedProps["source"] {
  if (!referrer) return "direct";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "direct";
  }
  if (url.origin !== siteOrigin) return "external";
  if (url.pathname.startsWith("/cauta")) return "search";
  if (url.pathname.startsWith("/mo/")) return "document";
  if (url.pathname.startsWith("/politicieni/")) return "person";
  return "direct";
}
