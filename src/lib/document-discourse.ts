// Document-level discourse summary helpers for the document page (Phase 3).
// `listDocumentChildren` already returns full speech `_source` payloads on the
// document page render, so this module derives the per-page / per-agenda /
// per-speech summaries client-server-side without an extra ES round-trip.

import type { ChildGrainHit } from "./search";
import { passesDiscourseFilter, VOICE_FIRST_PERSON } from "./discourse-params";
import type { DiscourseUiParams } from "./discourse-params";
import type { DiscourseFramework, DiscourseVoice, MoSpeech } from "./types";

export interface DocumentSpeechSummary {
  hScore: 0 | 1 | 2 | null;
  vScore: 0 | 1 | 2 | null;
  dqiLevel: 0 | 1 | 2 | 3 | null;
  dominantVoice: DiscourseVoice;
  hawkinsMarkers: number;
  vpartyMarkers: number;
  dqiMarkers: number;
}

export interface DocumentTopMarker {
  framework: DiscourseFramework;
  kind: string;
  count: number;
}

export interface DocumentAgendaSummary {
  agendaOrdinal: number;
  codedCount: number;
  hCounts: { 0: number; 1: number; 2: number };
  vCounts: { 0: number; 1: number; 2: number };
  topMarkerKinds: DocumentTopMarker[];
}

export interface DocumentDiscourseSummary {
  // Whole-document counts.
  totalSubstantive: number;
  codedCount: number;
  hCounts: { 0: number; 1: number; 2: number };
  vCounts: { 0: number; 1: number; 2: number };
  topMarkerKinds: DocumentTopMarker[];
  perAgenda: Map<number, DocumentAgendaSummary>;
  perSpeech: Map<string, DocumentSpeechSummary>;
  producerLabel: string | null;
}

const TOP_MARKER_LIMIT = 5;

function speechSummary(speech: MoSpeech, params: DiscourseUiParams): DocumentSpeechSummary | null {
  const d = speech.enrichments?.discourse;
  if (!d) return null;
  // Apply voice filter at the speech level (mirrors the Phase-2 trajectory
  // semantics): when the chip is "first-person", only count speeches whose
  // dominant_voice is the first-person value.
  const dominantVoice = (d.voice?.dominant_voice ?? VOICE_FIRST_PERSON) as DiscourseVoice;
  if (!passesDiscourseFilter(params, dominantVoice, null)) return null;
  // Confidence: gate per-framework; a speech without ANY framework passing
  // the threshold drops out of the summary (otherwise the page count goes
  // out of sync with what the chips claim).
  const passH =
    !d.hawkins ||
    typeof d.hawkins.framework_confidence !== "number" ||
    params.confidenceMin === null ||
    d.hawkins.framework_confidence >= params.confidenceMin;
  const passV =
    !d.vparty ||
    typeof d.vparty.framework_confidence !== "number" ||
    params.confidenceMin === null ||
    d.vparty.framework_confidence >= params.confidenceMin;
  const passDqi =
    !d.dqi ||
    typeof d.dqi.framework_confidence !== "number" ||
    params.confidenceMin === null ||
    d.dqi.framework_confidence >= params.confidenceMin;
  if (!passH && !passV && !passDqi) return null;
  return {
    hScore: passH ? scoreOrNull(d.hawkins?.score) : null,
    vScore: passV ? scoreOrNull(d.vparty?.score) : null,
    dqiLevel: passDqi ? dqiLevelOrNull(d.dqi?.level_of_justification) : null,
    dominantVoice,
    hawkinsMarkers: passH && d.hawkins?.marker_count ? d.hawkins.marker_count : 0,
    vpartyMarkers: passV && d.vparty?.marker_count ? d.vparty.marker_count : 0,
    dqiMarkers: passDqi && d.dqi?.markers ? d.dqi.markers.length : 0,
  };
}

export function summarizeDocumentDiscourse(
  children: ChildGrainHit[],
  params: DiscourseUiParams,
): DocumentDiscourseSummary {
  const summary: DocumentDiscourseSummary = {
    totalSubstantive: 0,
    codedCount: 0,
    hCounts: { 0: 0, 1: 0, 2: 0 },
    vCounts: { 0: 0, 1: 0, 2: 0 },
    topMarkerKinds: [],
    perAgenda: new Map(),
    perSpeech: new Map(),
    producerLabel: null,
  };
  const markerKindCounts = new Map<string, { framework: DiscourseFramework; count: number }>();
  const agendaMarkerCounts = new Map<
    number,
    Map<string, { framework: DiscourseFramework; count: number }>
  >();
  for (const child of children) {
    if (child.grain !== "speeches") continue;
    const speech = child as MoSpeech;
    if (!speech.is_substantive) continue;
    summary.totalSubstantive += 1;
    const ss = speechSummary(speech, params);
    if (!ss) continue;
    summary.codedCount += 1;
    if (!summary.producerLabel && speech.enrichments?.discourse_producer) {
      summary.producerLabel = speech.enrichments.discourse_producer;
    }
    if (ss.hScore !== null) summary.hCounts[ss.hScore] += 1;
    if (ss.vScore !== null) summary.vCounts[ss.vScore] += 1;
    summary.perSpeech.set(speech.record_id, ss);
    // Top marker kinds (whole doc + per agenda).
    const d = speech.enrichments?.discourse;
    const hKinds = d?.hawkins?.marker_kinds ?? [];
    const vKinds = d?.vparty?.marker_kinds ?? [];
    const accumulate = (kind: string, framework: DiscourseFramework) => {
      const key = `${framework}:${kind}`;
      const cur = markerKindCounts.get(key);
      markerKindCounts.set(key, { framework, count: (cur?.count ?? 0) + 1 });
    };
    hKinds.forEach((k) => accumulate(k, "hawkins"));
    vKinds.forEach((k) => accumulate(k, "vparty"));
    // Per-agenda rollup
    const ord = speech.agenda_ordinal;
    if (typeof ord === "number") {
      let agendaSummary = summary.perAgenda.get(ord);
      if (!agendaSummary) {
        agendaSummary = {
          agendaOrdinal: ord,
          codedCount: 0,
          hCounts: { 0: 0, 1: 0, 2: 0 },
          vCounts: { 0: 0, 1: 0, 2: 0 },
          topMarkerKinds: [],
        };
        summary.perAgenda.set(ord, agendaSummary);
      }
      agendaSummary.codedCount += 1;
      if (ss.hScore !== null) agendaSummary.hCounts[ss.hScore] += 1;
      if (ss.vScore !== null) agendaSummary.vCounts[ss.vScore] += 1;
      let agendaMarkers = agendaMarkerCounts.get(ord);
      if (!agendaMarkers) {
        agendaMarkers = new Map();
        agendaMarkerCounts.set(ord, agendaMarkers);
      }
      const accAgenda = (kind: string, framework: DiscourseFramework) => {
        const key = `${framework}:${kind}`;
        const cur = agendaMarkers!.get(key);
        agendaMarkers!.set(key, { framework, count: (cur?.count ?? 0) + 1 });
      };
      hKinds.forEach((k) => accAgenda(k, "hawkins"));
      vKinds.forEach((k) => accAgenda(k, "vparty"));
    }
  }
  summary.topMarkerKinds = pickTopMarkerKinds(markerKindCounts, TOP_MARKER_LIMIT);
  for (const [ord, kinds] of agendaMarkerCounts.entries()) {
    const a = summary.perAgenda.get(ord);
    if (a) a.topMarkerKinds = pickTopMarkerKinds(kinds, 3);
  }
  return summary;
}

function pickTopMarkerKinds(
  m: Map<string, { framework: DiscourseFramework; count: number }>,
  limit: number,
): DocumentTopMarker[] {
  const out: DocumentTopMarker[] = [];
  for (const [key, info] of m.entries()) {
    const kind = key.slice(key.indexOf(":") + 1);
    out.push({ framework: info.framework, kind, count: info.count });
  }
  out.sort((a, b) => b.count - a.count);
  return out.slice(0, limit);
}

function scoreOrNull(v: unknown): 0 | 1 | 2 | null {
  if (v === 0 || v === 1 || v === 2) return v;
  return null;
}

function dqiLevelOrNull(v: unknown): 0 | 1 | 2 | 3 | null {
  if (v === 0 || v === 1 || v === 2 || v === 3) return v;
  return null;
}
