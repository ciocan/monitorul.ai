// Marker resolution + overlay-prep helpers for the discourse-UI surfaces.
// Lifts the per-speech `_source.enrichments.discourse.*` payload into the
// shapes the components expect:
//
//   - One "MarkerView" per marker, carrying framework / kind / evidence /
//     voice (resolved from the voice classifier when present, defaulted to
//     speaker_first_person otherwise) / confidence.
//   - A "PreparedOverlay" per speech: paragraphs + per-paragraph marker spans,
//     ready for the renderer to walk.
//
// Two design decisions worth pinning here:
//
// 1. **Voice resolution.** The voice classifier in v0.1 runs only over Hawkins
//    markers. V-Party / DQI markers don't have explicit voice attributions —
//    they default to `speaker_first_person` per schema Q5 (the default-voice
//    rule). The renderer treats this as if the producer had emitted that
//    explicit value.
//
// 2. **Filter semantics.** Overlay markers respect the same `?voice` and
//    `?conf` URL params as the rest of the discourse UI. A marker whose
//    voice / framework_confidence fail the filter is *hidden from the inline
//    overlay AND from the side panel* — but the underlying text never moves
//    (we render the text either with or without the highlight, never with
//    a "[redacted span]" marker). This keeps the body legible regardless of
//    chip state.

import { passesDiscourseFilter, VOICE_FIRST_PERSON } from "./discourse-params";
import type { DiscourseUiParams } from "./discourse-params";
import type {
  DiscourseDqiMarker,
  DiscourseEnrichment,
  DiscourseEvidence,
  DiscourseFramework,
  DiscourseHvMarker,
  DiscourseVoice,
  MoSpeech,
} from "./types";

export interface MarkerView {
  // Stable id within a speech, prefixed with framework so an overlay's React
  // keys don't collide across H / V / DQI markers at the same index.
  id: string;
  // Position within the framework's `markers[]` (`m_0`, `m_1`, …) — used to
  // join voice classifications.
  positionalId: string;
  framework: DiscourseFramework;
  kind: string;
  evidence: DiscourseEvidence;
  voice: DiscourseVoice;
  voiceConfidence: number | null;
  voiceEvidence: DiscourseEvidence | null;
  attributedTo: string | null;
  markerConfidence: number | null;
  frameworkConfidence: number | null;
  rationaleShort: string | null;
  // For DQI markers, the ordinal/categorical value the marker carries.
  dqiValue: string | null;
}

export interface ParagraphSpan {
  // [start, end) offsets relative to the paragraph (NOT the full text).
  start: number;
  end: number;
  markers: MarkerView[];
}

export interface PreparedParagraph {
  text: string;
  // Absolute char offset into the speech `text` where this paragraph starts.
  // Used to flash-target a paragraph from a side-panel click.
  absoluteStart: number;
  // Pre-computed sorted, non-overlapping segments. Each segment is either a
  // plain text run (markers empty) or a marked run (markers non-empty).
  segments: ParagraphSegment[];
}

export interface ParagraphSegment {
  text: string;
  // The segment's offset within its paragraph (used to render react keys).
  offset: number;
  markers: MarkerView[];
}

export interface PreparedOverlay {
  paragraphs: PreparedParagraph[];
  visibleMarkers: MarkerView[];
  // Total count before filter — used in the "fără marcheri" footer text.
  totalMarkers: number;
}

const FRAMEWORK_PREFIX: Record<DiscourseFramework, string> = {
  hawkins: "h",
  vparty: "v",
  dqi: "d",
  voice: "v?",
};

function positionalId(framework: DiscourseFramework, index: number): string {
  return `${FRAMEWORK_PREFIX[framework]}_${index}`;
}

function fullId(framework: DiscourseFramework, index: number): string {
  return `${framework}-m${index}`;
}

// Build a position→voice lookup from the voice classifier's output. The
// classifier in v0.1 runs over Hawkins markers, so its `marker_id` keys
// are positional into `discourse.hawkins.markers`. Returns a Map keyed by
// the same `m_<index>` strings the classifier emits.
function buildVoiceMap(discourse: DiscourseEnrichment | undefined): Map<
  string,
  {
    voice: DiscourseVoice;
    confidence: number;
    evidence: DiscourseEvidence | null;
    attributedTo: string | null;
  }
> {
  const map = new Map<
    string,
    {
      voice: DiscourseVoice;
      confidence: number;
      evidence: DiscourseEvidence | null;
      attributedTo: string | null;
    }
  >();
  const classifications = discourse?.voice?.classifications ?? [];
  for (const c of classifications) {
    if (!c?.marker_id || !c.voice) continue;
    map.set(c.marker_id, {
      voice: c.voice,
      confidence: typeof c.voice_confidence === "number" ? c.voice_confidence : 1,
      evidence: c.voice_evidence ?? null,
      attributedTo: c.attributed_to ?? null,
    });
  }
  return map;
}

function buildHvMarkerView(
  framework: "hawkins" | "vparty",
  marker: DiscourseHvMarker,
  index: number,
  voiceMap: Map<
    string,
    {
      voice: DiscourseVoice;
      confidence: number;
      evidence: DiscourseEvidence | null;
      attributedTo: string | null;
    }
  >,
  frameworkConfidence: number | null,
): MarkerView | null {
  if (!marker?.evidence?.text) return null;
  // Voice classifier maps to Hawkins; V-Party defaults to first-person.
  const posId = positionalId(framework, index);
  const voiceLookup = framework === "hawkins" ? voiceMap.get(posId) : undefined;
  const voice = (marker.voice ?? voiceLookup?.voice ?? VOICE_FIRST_PERSON) as DiscourseVoice;
  return {
    id: fullId(framework, index),
    positionalId: posId,
    framework,
    kind: marker.kind,
    evidence: marker.evidence,
    voice,
    voiceConfidence:
      typeof marker.voice_confidence === "number"
        ? marker.voice_confidence
        : (voiceLookup?.confidence ?? null),
    voiceEvidence: voiceLookup?.evidence ?? null,
    attributedTo: marker.attributed_to ?? voiceLookup?.attributedTo ?? null,
    markerConfidence: marker.marker_confidence ?? null,
    frameworkConfidence,
    rationaleShort: marker.rationale_short ?? null,
    dqiValue: null,
  };
}

function buildDqiMarkerView(
  marker: DiscourseDqiMarker,
  index: number,
  frameworkConfidence: number | null,
): MarkerView | null {
  if (!marker?.evidence?.text) return null;
  return {
    id: fullId("dqi", index),
    positionalId: positionalId("dqi", index),
    framework: "dqi",
    kind: marker.kind,
    evidence: marker.evidence,
    voice: (marker.voice ?? VOICE_FIRST_PERSON) as DiscourseVoice,
    voiceConfidence: marker.voice_confidence ?? null,
    voiceEvidence: null,
    attributedTo: marker.attributed_to ?? null,
    markerConfidence: marker.marker_confidence ?? null,
    frameworkConfidence,
    rationaleShort: marker.rationale_short ?? null,
    dqiValue: marker.value ?? null,
  };
}

export function collectMarkers(speech: MoSpeech): MarkerView[] {
  const discourse = speech.enrichments?.discourse;
  if (!discourse) return [];
  const voiceMap = buildVoiceMap(discourse);
  const out: MarkerView[] = [];
  const hawkins = discourse.hawkins;
  if (hawkins?.markers?.length) {
    hawkins.markers.forEach((m, i) => {
      const v = buildHvMarkerView("hawkins", m, i, voiceMap, hawkins.framework_confidence ?? null);
      if (v) out.push(v);
    });
  }
  const vparty = discourse.vparty;
  if (vparty?.markers?.length) {
    vparty.markers.forEach((m, i) => {
      const v = buildHvMarkerView("vparty", m, i, voiceMap, vparty.framework_confidence ?? null);
      if (v) out.push(v);
    });
  }
  const dqi = discourse.dqi;
  if (dqi?.markers?.length) {
    dqi.markers.forEach((m, i) => {
      const v = buildDqiMarkerView(m, i, dqi.framework_confidence ?? null);
      if (v) out.push(v);
    });
  }
  return out;
}

// Resolve a marker's evidence to an absolute (start, end) span in the speech
// text. Prefers the producer-supplied `char_range`; falls back to a
// `text.indexOf(evidence.text)` lookup for paraphrased / drift cases. Returns
// null when the evidence text doesn't appear in the body at all (e.g. a
// rephrased verbatim quote that diverges from the actual text).
export function resolveSpan(
  marker: MarkerView,
  body: string,
): { start: number; end: number } | null {
  const range = marker.evidence.char_range;
  if (Array.isArray(range) && range.length === 2) {
    const [s, e] = range;
    if (Number.isInteger(s) && Number.isInteger(e) && s >= 0 && e > s && e <= body.length) {
      // Sanity check the producer's claim — substring at [s,e) should at
      // least loosely resemble evidence.text. A mismatch with no obvious
      // fallback drops the marker so we don't paint the wrong span.
      const actual = body.slice(s, e);
      if (actual === marker.evidence.text) {
        return { start: s, end: e };
      }
      // Tolerant: case-insensitive equality, common typography drift.
      if (actual.localeCompare(marker.evidence.text, "ro", { sensitivity: "base" }) === 0) {
        return { start: s, end: e };
      }
    }
  }
  // Fallback path: scan the body for the evidence text.
  if (marker.evidence.text && marker.evidence.text.length > 1) {
    const idx = body.indexOf(marker.evidence.text);
    if (idx >= 0) return { start: idx, end: idx + marker.evidence.text.length };
  }
  return null;
}

interface MarkerWithSpan {
  marker: MarkerView;
  start: number;
  end: number;
}

// Split the body into paragraphs preserving absolute offsets so per-paragraph
// markers know how to slice. Using the same `\n\n+` boundary as the page's
// existing renderer, but capturing the pre-split offsets too.
function splitIntoParagraphs(body: string): { text: string; start: number; end: number }[] {
  const paras: { text: string; start: number; end: number }[] = [];
  const re = /\n\n+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const text = body.slice(last, m.index);
    if (text.trim()) paras.push({ text, start: last, end: m.index });
    last = re.lastIndex;
  }
  const tail = body.slice(last);
  if (tail.trim()) paras.push({ text: tail, start: last, end: body.length });
  return paras;
}

// Within a paragraph, build the non-overlapping segment list. Markers can
// overlap on the same span (Hawkins + V-Party) — we collect all overlapping
// markers into a single segment so the highlight is one visual span with
// stacked margin chips.
function buildSegments(
  paraText: string,
  paraStart: number,
  marked: MarkerWithSpan[],
): ParagraphSegment[] {
  if (marked.length === 0) {
    return [{ text: paraText, offset: 0, markers: [] }];
  }
  // Build cut points from marker boundaries; any unique offset is a cut.
  const cuts = new Set<number>();
  cuts.add(0);
  cuts.add(paraText.length);
  for (const m of marked) {
    cuts.add(m.start - paraStart);
    cuts.add(m.end - paraStart);
  }
  const ordered = [...cuts].filter((c) => c >= 0 && c <= paraText.length).sort((a, b) => a - b);
  const segments: ParagraphSegment[] = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const segStart = ordered[i];
    const segEnd = ordered[i + 1];
    if (segStart === segEnd) continue;
    const text = paraText.slice(segStart, segEnd);
    const markers = marked
      .filter((m) => m.start - paraStart <= segStart && m.end - paraStart >= segEnd)
      .map((m) => m.marker);
    segments.push({ text, offset: segStart, markers });
  }
  return segments;
}

export function prepareOverlay(speech: MoSpeech, params: DiscourseUiParams): PreparedOverlay {
  const body = speech.text ?? "";
  const allMarkers = collectMarkers(speech);
  const visible = allMarkers.filter((m) =>
    passesDiscourseFilter(params, m.voice, m.frameworkConfidence),
  );
  if (!body) {
    return { paragraphs: [], visibleMarkers: visible, totalMarkers: allMarkers.length };
  }
  // Resolve spans in the body.
  const positioned: MarkerWithSpan[] = [];
  for (const m of visible) {
    const span = resolveSpan(m, body);
    if (span) positioned.push({ marker: m, start: span.start, end: span.end });
  }
  // Split into paragraphs and bin markers into them.
  const paras = splitIntoParagraphs(body);
  const prepared: PreparedParagraph[] = paras.map((p) => {
    const inPara = positioned
      .filter((mw) => mw.start >= p.start && mw.end <= p.end)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    return {
      text: p.text,
      absoluteStart: p.start,
      segments: buildSegments(p.text, p.start, inPara),
    };
  });
  return { paragraphs: prepared, visibleMarkers: visible, totalMarkers: allMarkers.length };
}

// Voice → inline highlight className (Q6 mapping). The bg/text/decoration
// is non-disruptive so the body remains readable; voice information is the
// load-bearing visual (defamation discipline) and framework chips ride in
// the margin separately.
export function voiceHighlightClass(voice: DiscourseVoice): string {
  switch (voice) {
    case "speaker_first_person":
      return "bg-azure-3/8 underline decoration-azure-3/40 decoration-2 underline-offset-4";
    case "quoted":
    case "reported":
      return "bg-paper-91/60 italic text-ink-45 underline decoration-paper-91 decoration-dashed underline-offset-4";
    case "negated":
      return "line-through decoration-ink-45/80 decoration-1";
    case "apophasis_disclaimed":
    case "weasel_attribution":
      return "italic text-ink-45 underline decoration-ink-45 decoration-dotted underline-offset-4";
    case "hypothetical":
    case "sarcastic":
    case "interrogative":
      return "italic text-ink-45";
    case "uncertain":
    default:
      return "underline decoration-paper-91 decoration-dashed underline-offset-4";
  }
}
