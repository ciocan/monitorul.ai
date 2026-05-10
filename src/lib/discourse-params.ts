// URL-param helpers for the discourse-UI chips. Two non-canonical params
// shared across `/discurs/[slug]`, `/politicieni/[slug]`,
// `/mo/[year]/[part]/[issue]`, and `/statistici`:
//
//   ?voice=all       — include quoted / reported / negated / apophasis /
//                       hypothetical / sarcastic / interrogative / uncertain
//                       voices in aggregations and overlays. Omitted ⇒
//                       voice = "speaker_first_person" only.
//   ?conf=07         — exclude codings with framework_confidence < 0.7. Omitted
//                       ⇒ no confidence threshold (all codings shown).
//
// Both stay off the `<link rel="canonical">` URL — see CLAUDE.md "URL contract"
// notes — so a year-page or politician-page hit on Google never indexes the
// chip-toggled variant.

import type { DiscourseVoice } from "./types";

export interface DiscourseUiParams {
  // `null` ⇒ default (first-person only). `"all"` ⇒ all voices.
  voiceMode: "first-person" | "all";
  // `null` ⇒ default (no threshold). `0.7` ⇒ filter to >= 0.7.
  confidenceMin: number | null;
}

export const VOICE_FIRST_PERSON = "speaker_first_person" as const satisfies DiscourseVoice;

// Voices the "Toate vocile" toggle adds to the substrate. Anything not on
// this list (e.g. `uncertain`) is excluded from both views — uncertain voice
// codings are documented in schema Q5 as a "must declare" signal but are
// poison for both rankings and overlays.
export const NON_FIRST_PERSON_VOICES: DiscourseVoice[] = [
  "quoted",
  "reported",
  "negated",
  "hypothetical",
  "apophasis_disclaimed",
  "weasel_attribution",
  "sarcastic",
  "interrogative",
];

export function parseDiscourseParams(
  raw: Record<string, string | string[] | undefined>,
): DiscourseUiParams {
  const voiceRaw = pickFirst(raw.voice);
  const confRaw = pickFirst(raw.conf);
  const voiceMode = voiceRaw === "all" ? "all" : "first-person";
  const confidenceMin = confRaw === "07" ? 0.7 : null;
  return { voiceMode, confidenceMin };
}

// Build a fresh URLSearchParams clone with the discourse params overridden.
// Used by the toggle components when they re-link to the same page with the
// chip flipped. `null`/default values are stripped so URLs stay terse.
export function withDiscourseParams(
  base: URLSearchParams,
  next: Partial<DiscourseUiParams>,
): URLSearchParams {
  const out = new URLSearchParams(base);
  if (next.voiceMode !== undefined) {
    if (next.voiceMode === "all") out.set("voice", "all");
    else out.delete("voice");
  }
  if (next.confidenceMin !== undefined) {
    if (next.confidenceMin === 0.7) out.set("conf", "07");
    else out.delete("conf");
  }
  return out;
}

function pickFirst(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return v.trim();
}

// True when a (voice, framework_confidence) pair passes the current chip
// state. Used everywhere the renderer aggregates or filters per-marker /
// per-coding. Markers without an explicit voice default to first-person
// (matches schema Q5 default-voice semantics).
export function passesDiscourseFilter(
  params: DiscourseUiParams,
  voice: DiscourseVoice | null | undefined,
  frameworkConfidence: number | null | undefined,
): boolean {
  const effectiveVoice: DiscourseVoice = voice ?? VOICE_FIRST_PERSON;
  if (params.voiceMode === "first-person" && effectiveVoice !== VOICE_FIRST_PERSON) {
    return false;
  }
  if (params.confidenceMin !== null) {
    if (typeof frameworkConfidence !== "number") return false;
    if (frameworkConfidence < params.confidenceMin) return false;
  }
  return true;
}
