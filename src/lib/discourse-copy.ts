// Romanian copy for the discourse-analysis layer. Single source of truth for
// every label the UI shows: framework names, marker kinds, voice values, DQI
// sub-codings. Keeps the user-facing strings out of the components and lets
// the frontend evolve the copy without scattering edits across files.
//
// Marker enums lifted from `../monitorul/docs/discourse-analysis-schema.md`
// Q4 (Hawkins's 7-marker rubric, V-Party 5-marker rubric, DQI Steiner-Bächtiger
// 6-axis rubric) and Q5 (the closed voice enum).
//
// Conventions
//  - Sentence case (not Title Case) for marker labels — matches the editorial
//    archival register in DESIGN.md.
//  - Civic, neutral wording. No SaaS hype, no judgy adjectives.
//  - Preserve diacritics (ș/ț/ă/â/î). These are user-facing strings, not slugs.

import type { DiscourseFramework, DiscourseVoice } from "./types";

// ---------------------------------------------------------------------------
// Frameworks

export const FRAMEWORK_LABEL: Record<DiscourseFramework, string> = {
  hawkins: "Populism",
  vparty: "Anti-pluralism",
  dqi: "Calitate deliberativă",
  voice: "Voce",
};

export const FRAMEWORK_LABEL_LONG: Record<DiscourseFramework, string> = {
  hawkins: "Populism (Hawkins)",
  vparty: "Anti-pluralism (V-Party)",
  dqi: "Calitate deliberativă (DQI)",
  voice: "Atribuire de voce",
};

// Short academic citation rendered as a footnote next to the framework label.
// Read straight from `framework_version` on the indexed coding when present;
// these defaults match the producer's pinned versions.
export const FRAMEWORK_CITE_DEFAULT: Record<DiscourseFramework, string> = {
  hawkins: "Hawkins 2018",
  vparty: "V-Party / V-Dem v3",
  dqi: "Steiner & Bächtiger 2017",
  voice: "monitorul-ii voice@v1",
};

export function frameworkLabel(framework: DiscourseFramework, long = false): string {
  return long ? FRAMEWORK_LABEL_LONG[framework] : FRAMEWORK_LABEL[framework];
}

// ---------------------------------------------------------------------------
// Hawkins markers (populism, 7-kind closed enum)

const HAWKINS_KIND_LABEL: Record<string, string> = {
  people_vs_elite: "popor vs elite",
  moralistic_manichaeism: "maniheism moral",
  homogeneous_people: "popor omogen",
  evil_elite: "elită coruptă",
  popular_will_supremacy: "supremația voinței populare",
  crisis_invocation: "invocarea crizei",
  cosmic_proportions: "miză cosmică",
};

// ---------------------------------------------------------------------------
// V-Party markers (anti-pluralism, 5-kind closed enum + V-Dem extensions)

const VPARTY_KIND_LABEL: Record<string, string> = {
  opposition_delegitimization: "delegitimarea opoziției",
  media_hostility: "ostilitate față de presă",
  judiciary_attack: "atac la justiție",
  minority_scapegoating: "vinovăție colectivă pe minorități",
  democratic_norms_rejection: "respingerea normelor democratice",
  // V-Dem attacks-on extensions sometimes ride into the V-Party block in
  // mixed prompts; render them gracefully.
  judiciary: "atac la justiție",
  opposition: "delegitimarea opoziției",
  media: "ostilitate față de presă",
  minorities: "vinovăție colectivă pe minorități",
  civil_society: "atac la societatea civilă",
};

// ---------------------------------------------------------------------------
// DQI markers (Steiner-Bächtiger, 6 sub-codings)

const DQI_KIND_LABEL: Record<string, string> = {
  level_of_justification: "nivelul justificării",
  content_of_justification: "conținutul justificării",
  respect_for_groups: "respect față de grupuri",
  respect_for_demands: "respect față de cereri",
  respect_for_counterarguments: "respect față de contraargumente",
  constructive_politics: "politică constructivă",
};

// Categorical values inside the DQI markers.
export const DQI_LEVEL_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "fără justificare",
  1: "justificare inferioară",
  2: "justificare calificată",
  3: "justificare sofisticată",
};

export const DQI_CONTENT_LABEL: Record<string, string> = {
  none: "niciuna",
  group_interest: "interes de grup",
  common_good: "binele comun",
  mixed: "mixtă",
};

export const DQI_RESPECT_LABEL: Record<0 | 1 | 2, string> = {
  0: "ignorat",
  1: "neutru",
  2: "explicit recunoscut",
};

export const DQI_CONSTRUCTIVE_LABEL: Record<string, string> = {
  positional: "poziţional",
  alternative_proposal: "propunere alternativă",
  mediating_proposal: "propunere de mediere",
};

// ---------------------------------------------------------------------------
// Voice (closed enum from schema Q5)

const VOICE_LABEL: Record<DiscourseVoice, string> = {
  speaker_first_person: "voce proprie",
  quoted: "citat",
  reported: "vorbire indirectă",
  negated: "negat",
  hypothetical: "ipotetic",
  apophasis_disclaimed: "apofază (negare retorică)",
  weasel_attribution: "atribuire echivocă",
  sarcastic: "sarcastic",
  interrogative: "întrebare retorică",
  uncertain: "incertă",
};

// Slightly longer hover-label for the voice toggle's tooltip.
const VOICE_LABEL_LONG: Record<DiscourseVoice, string> = {
  speaker_first_person: "vorbitorul afirmă în nume propriu",
  quoted: "vorbitorul citează pe altcineva",
  reported: "vorbitorul transmite ce a spus altcineva",
  negated: "vorbitorul respinge afirmația",
  hypothetical: "vorbitorul ipotetizează",
  apophasis_disclaimed: "vorbitorul afirmă negând („Nu spun că X, dar...”)",
  weasel_attribution: "atribuire vagă („Unii spun că...”)",
  sarcastic: "ironie / sarcasm",
  interrogative: "întrebare retorică",
  uncertain: "clasificator nesigur",
};

export function voiceLabel(voice: DiscourseVoice, long = false): string {
  return long ? VOICE_LABEL_LONG[voice] : VOICE_LABEL[voice];
}

// ---------------------------------------------------------------------------
// Public API

// Render a marker kind label for a framework. Falls back to the raw enum
// string when the kind is unknown (rather than swallowing the value silently)
// so a producer-prompt evolution surfaces in the UI rather than degrading
// invisibly.
export function markerKindLabel(framework: DiscourseFramework, kind: string): string {
  const table =
    framework === "hawkins"
      ? HAWKINS_KIND_LABEL
      : framework === "vparty"
        ? VPARTY_KIND_LABEL
        : framework === "dqi"
          ? DQI_KIND_LABEL
          : null;
  if (!table) return kind;
  return table[kind] ?? kind;
}

// Score-tier label for Hawkins / V-Party 0/1/2 ordinals. Used in the inline
// chips ("[H=1 V=0]") and the tab strip's "current score" tooltip.
export function hvScoreLabel(score: 0 | 1 | 2): string {
  if (score === 0) return "fără";
  if (score === 1) return "moderat";
  return "marcant";
}
