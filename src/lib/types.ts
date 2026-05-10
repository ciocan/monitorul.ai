// ES-projected record shapes consumed by monitorul.ai. Authoritative reference:
// docs/architecture.md (this repo) and elasticsearch-indexing.md (monitorul-ii).

export type Chamber = "Camera Deputaților" | "Senat";

export type DocumentType =
  | "plenary_stenogram"
  | "plenary_joint_session"
  | "committee_synthesis"
  | "question_register"
  | "report_facsimile";

export interface CommonFields {
  record_id: string;
  document_id: string;
  content_fingerprint: string;
  content_sha_source?: string | null;
  indexed_at: string;
  extractor_versions: Record<string, string>;
  enrichment_versions: Record<string, string>;
  schema_version: string;
}

export interface MoDocument extends CommonFields {
  chamber: Chamber | null;
  part: string;
  issue: string;
  year: number;
  published: string | null;
  session_date: string | null;
  session_type: string | null;
  legislature: string | null;
  document_type: DocumentType;
  title: string;
  summary: string | null;
  agenda_count: number;
  speech_count: number;
  vote_count: number;
  interpellation_count: number;
  question_count: number;
  committee_count: number;
  report_count: number;
  coverage: { claimed_pct: number; body_chars: number } | null;
  s3_url_pdf: string | null;
  s3_url_md: string | null;
  s3_url_sidecar: string | null;
  slug: string;
  url_path: string;
}

export interface RefsBlock {
  types: string[];
  bills: string[];
  laws: string[];
  codes: string[];
  ougs?: string[];
  ogs?: string[];
  raw: string[];
}

export interface MoAgendaItem extends CommonFields {
  chamber: Chamber | null;
  session_date: string | null;
  legislature: string | null;
  ordinal: number;
  position_in_document: number | null;
  category: string | null;
  title: string;
  outcome: string | null;
  confidence_type: string | null;
  requested_by_group: string | null;
  reexamination_reason: string | null;
  topics_primary: string[];
  refs: RefsBlock;
  speaker_person_ids: string[];
  vote_summary: { total_votes: number; outcomes: string[] };
  enrichments: { summary?: string; topics?: string[] };
  slug: string;
  url_path: string;
}

export interface Speaker {
  person_id: string | null;
  name_raw: string;
  name_search: string | null;
  title: string | null;
  role: string | null;
  party_group_at_time: string | null;
  delivery_mode: string | null;
}

export interface MoSpeech extends CommonFields {
  chamber: Chamber | null;
  session_date: string | null;
  session_type: string | null;
  legislature: string | null;
  year: number;
  mo_issue: string;
  agenda_ordinal: number;
  agenda_title: string;
  agenda_category: string | null;
  agenda_outcome: string | null;
  speaker: Speaker;
  text?: string;
  text_length: number;
  is_substantive: boolean;
  position_in_agenda: number;
  position_in_document: number | null;
  refs: RefsBlock;
  enrichments: {
    topics?: string[];
    summary?: string;
    embedding_text_fingerprint?: string;
    /**
     * Discourse-analysis output (Hawkins / voice / DQI / V-Party) — see
     * the producer at `../monitorul/src/monitorul_ii/extraction/enrichments/discourse.py`
     * and the retrieval-time guide at `../monitorul/docs/discourse-and-semantic-search.md`.
     * Sparse: only populated for substantive speeches that have been
     * coded by `monitorul-ii analyze`.
     *
     * Two layers in one object:
     *  - **Aggregates** (`score`, `framework_confidence`, `marker_count`,
     *    `marker_kinds`, `dominant_voice`, the six DQI sub-codings) are
     *    indexed as ES fields and queryable via the filter primitives in
     *    `searchSpeeches`.
     *  - **Markers / classifications / rationale** ride inside `_source`
     *    only — they are not indexed for filtering but round-trip on every
     *    `getSpeech` / `getSpeechBySlug` call. The frontend uses them to
     *    render the inline-highlight + side-panel pattern documented in
     *    `discourse-and-semantic-search.md` lines 382–429.
     */
    discourse?: DiscourseEnrichment;
    discourse_producer?: string;
    discourse_text_fingerprint?: string;
  };
  slug: string;
  url_path: string;
}

// ---------------------------------------------------------------------------
// Discourse-analysis shapes (per `../monitorul/docs/discourse-analysis-schema.md`).

export type DiscourseFramework = "hawkins" | "vparty" | "dqi" | "voice";

// The closed voice enum lifted from
// `../monitorul/docs/discourse-analysis-schema.md` Q5. The default value when
// the producer didn't emit a per-marker voice is `speaker_first_person`.
export type DiscourseVoice =
  | "speaker_first_person"
  | "quoted"
  | "reported"
  | "negated"
  | "hypothetical"
  | "apophasis_disclaimed"
  | "weasel_attribution"
  | "sarcastic"
  | "interrogative"
  | "uncertain";

// `char_range` is a half-open `[start, end)` byte slice into the parent
// `MoSpeech.text`. The producer's `find_text_offsets_tolerant` runs at index
// time so curly quotes / dashes / ellipsis paraphrases land byte-correct
// against `text`. May be absent when the model genuinely paraphrased the
// evidence; the renderer falls back to `text.indexOf(evidence.text)` and
// renders the imperfect match.
export interface DiscourseEvidence {
  text: string;
  char_range?: [number, number] | null;
}

interface DiscourseMarkerCommon {
  // Optional; some producers stamp `id: "m_<index>"` per marker, others rely
  // on positional index. The renderer derives "m_<position>" when absent.
  id?: string | null;
  marker_confidence?: number | null;
  framework_confidence?: number | null;
  rationale_short?: string | null;
  evidence: DiscourseEvidence;
  voice?: DiscourseVoice | null;
  voice_confidence?: number | null;
  attributed_to?: string | null;
}

// Hawkins / V-Party share a marker shape: `kind` is a closed enum per
// framework (e.g. `people_vs_elite` for Hawkins, `judiciary_attack` for
// V-Party). Voice on these markers comes from the voice classifier when
// it ran (Hawkins-marker triggered) or defaults to `speaker_first_person`.
export interface DiscourseHvMarker extends DiscourseMarkerCommon {
  kind: string;
  target?: string | null;
}

// DQI markers carry a stringified `value` per kind because DQI is multi-axis
// (categorical content_of_justification + 0–3 level_of_justification).
export interface DiscourseDqiMarker extends DiscourseMarkerCommon {
  kind:
    | "level_of_justification"
    | "content_of_justification"
    | "respect_for_groups"
    | "respect_for_demands"
    | "respect_for_counterarguments"
    | "constructive_politics";
  value: string;
}

export interface DiscourseFrameworkBlock<TMarker> {
  // The framework's holistic score, in its native unit. Hawkins / V-Party are
  // ordinal 0/1/2; DQI doesn't use this field (it has six sub-codings
  // instead).
  score?: 0 | 1 | 2 | null;
  framework_confidence: number;
  framework_version?: string | null;
  marker_count: number;
  marker_kinds?: string[];
  rationale?: string | null;
  // The full marker list. Carried inside `_source` (not indexed for filter).
  markers?: TMarker[];
}

export interface DqiBlock {
  level_of_justification: 0 | 1 | 2 | 3;
  content_of_justification: "none" | "group_interest" | "common_good" | "mixed";
  respect_for_groups: 0 | 1 | 2;
  respect_for_demands: 0 | 1 | 2;
  respect_for_counterarguments: 0 | 1 | 2;
  constructive_politics: "positional" | "alternative_proposal" | "mediating_proposal";
  framework_confidence: number;
  framework_version?: string | null;
  rationale?: string | null;
  markers?: DiscourseDqiMarker[];
}

export interface DiscourseVoiceClassification {
  // Position-based id (`m_0`, `m_1`, …) into the *Hawkins* `markers[]` array,
  // since voice runs only over Hawkins-emitted markers in v0.1 of the
  // pipeline. Frontend that wants per-marker voice on V-Party markers
  // defaults to `speaker_first_person`.
  marker_id: string;
  voice: DiscourseVoice;
  voice_confidence: number;
  attributed_to?: string | null;
  rationale_short?: string | null;
  voice_evidence?: DiscourseEvidence | null;
}

export interface VoiceBlock {
  dominant_voice: DiscourseVoice;
  voices_seen: DiscourseVoice[];
  classifications?: DiscourseVoiceClassification[];
}

export interface DiscourseEnrichment {
  hawkins?: DiscourseFrameworkBlock<DiscourseHvMarker>;
  vparty?: DiscourseFrameworkBlock<DiscourseHvMarker>;
  voice?: VoiceBlock;
  dqi?: DqiBlock;
}

export interface VoteCounts {
  for: number | null;
  for_unanimous: boolean | null;
  against: number | null;
  abstain: number | null;
  not_voting: number | null;
  total: number | null;
}

export interface MoVote extends CommonFields {
  chamber: Chamber | null;
  session_date: string | null;
  legislature: string | null;
  agenda_ordinal: number;
  agenda_title: string;
  agenda_category: string | null;
  motion_type: string | null;
  voting_method: string | null;
  outcome: string | null;
  counts: VoteCounts;
  quorum_met: boolean | null;
  deferred: boolean;
  defers_to: string | null;
  resolves: string[] | null;
  refs?: { types: string[]; bills: string[]; laws: string[] };
  proposed_by?: { person_id: string | null; name: string; is_government: boolean } | null;
  url_path: string;
  position_in_document?: number | null;
}

export interface MoInterpellation extends CommonFields {
  chamber: Chamber | null;
  session_date: string | null;
  legislature: string | null;
  interpellation_number: string | null;
  questioner: { person_id: string | null; name: string; party_group_at_time: string | null };
  addressed_to: string | null;
  addressed_to_normalized: string | null;
  topic: string | null;
  question_text: string | null;
  response: { speaker: { person_id: string | null; name: string }; text: string } | null;
  response_deferred: boolean;
  genre: string | null;
  delivery_mode: string | null;
  enrichments: { topics?: string[]; summary?: string };
  slug: string;
  url_path: string;
}

export interface MoQuestion extends CommonFields {
  chamber: Chamber | null;
  regnum: string;
  regdate: string | null;
  questioner: { person_id: string | null; name: string; party_group_at_time: string | null };
  addressee: {
    raw: string | null;
    ministry_normalized: string | null;
    institutional_normalized: string | null;
  };
  topic: string | null;
  text: string | null;
  delivery_mode: string | null;
  enrichments: { topics?: string[] };
  url_path: string;
}

export interface MoCommitteeMeeting extends CommonFields {
  committee_id: string;
  committee_name: string;
  committee_kind: string | null;
  joint_with: string[] | null;
  meeting_date: string | null;
  format: string | null;
  purpose: string | null;
  // Per the per-doc child grain convention (see docs/architecture.md). Used
  // by `listDocumentChildren` to interleave meetings with the rest of the
  // document body in source order, and by the document-page anchor.
  position_in_document?: number | null;
  agenda_items: Array<{
    ordinal: number;
    title: string;
    role: string | null;
    outcome: string | null;
    outcome_text: string | null;
    primary_references: string[];
  }>;
  roster: Array<{
    person_id: string | null;
    name: string;
    status: string | null;
    role: string | null;
    party_group_at_time: string | null;
  }>;
  signatures: { president_person_id: string | null; secretary_person_id: string | null };
  enrichments: { summary?: string; topics?: string[] };
  url_path: string;
}

export interface MoReport extends CommonFields {
  issuing_body: string;
  issuing_body_normalized: string | null;
  title: string;
  reporting_period: { from: string | null; to: string | null } | null;
  received_at: {
    session_date: string | null;
    session_kind: string | null;
    received_in_document: string | null;
  } | null;
  headings: Array<{ level: number; text: string }>;
  enrichments: { summary?: string; topics?: string[] };
  url_path: string;
}

export interface Mandate {
  role: string;
  chamber: string | null;
  legislature: string | null;
  from: string | null;
  to: string | null;
  party: string | null;
}

export interface MoPerson {
  id: string;
  canonical_name: string;
  diacritic_form: string;
  aliases: string[];
  wikidata_qid: string | null;
  birth_date: string | null;
  mandates: Mandate[];
  homonym_disambiguation: string | null;
  slug: string;
  url_path: string;
  stats: PersonStats | null;
  indexed_at: string;
}

export interface PersonStats {
  speech_count: number;
  first_speech_date: string | null;
  last_speech_date: string | null;
  interpellation_count: number;
  question_count: number;
}

export type Grain =
  | "documents"
  | "agenda-items"
  | "speeches"
  | "votes"
  | "interpellations"
  | "questions"
  | "committee-meetings"
  | "reports"
  | "persons";

export interface SearchResult<T> {
  hits: T[];
  total: number;
  page: number;
  pageSize: number;
  tookMs: number;
  // record_id → highlighted snippet from the matching field (already wrapped
  // in <mark>…</mark> on hit terms). Absent when the search had no `q`.
  highlights?: Record<string, string>;
  // Which retrieval mode actually served this response. The caller asks for
  // `rrf` by default; the layer falls back to `bm25-only` silently when the
  // embed service is unreachable, the query is empty, or the user has paged
  // past the RRF fusion pool. Surfaced so the UI can flag the mode.
  mode?: "rrf" | "bm25-only";
}

export interface PersonActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
}

// ---------------------------------------------------------------------------
// Discourse trajectory shapes (drives the politician page chart panel — Phase 2
// of the discourse-UI rollout). Per the Q5 grill decision: framework tabs +
// aggregate band + speech-dot scatter, one framework at a time. The payload
// computed by `personDiscourseTrajectory` carries everything the panel needs
// in a single ES round-trip.

export interface DiscourseTrajectoryMonth {
  // Bucket key, sortable lexicographically. Shape depends on the trajectory's
  // `granularity`: "YYYY-MM" when monthly (single year selected), "YYYY" when
  // yearly (career view, no year filter).
  month: string;
  // Counts of *coded* substantive speeches in this bucket, broken down by
  // each framework's score. `dqi` carries the level_of_justification 0/1/2/3
  // breakdown rather than the 0/1/2 score (DQI is multi-axis; the level is
  // the single most informative scalar).
  hawkins: { 0: number; 1: number; 2: number };
  vparty: { 0: number; 1: number; 2: number };
  dqi: { 0: number; 1: number; 2: number; 3: number };
  // Total *coded* speeches in this bucket — denominator for the rate framing.
  codedTotal: number;
}

export interface DiscourseSpeechDot {
  recordId: string;
  url: string;
  sessionDate: string; // YYYY-MM-DD
  // The five values we plot. Any may be null when the framework didn't fire.
  hScore: 0 | 1 | 2 | null;
  vScore: 0 | 1 | 2 | null;
  dqiLevel: 0 | 1 | 2 | 3 | null;
  dominantVoice: DiscourseVoice | null;
  // Hawkins's marker_count is the natural "how dense was the populist
  // language" proxy and drives the dot size.
  hawkinsMarkerCount: number;
  vpartyMarkerCount: number;
  hawkinsConfidence: number | null;
  vpartyConfidence: number | null;
}

export interface DiscourseTopMarker {
  framework: DiscourseFramework;
  kind: string;
  count: number;
}

export interface DiscourseVoiceMix {
  // Per-voice share (0..1) over the selected window. Used by the Voce tab's
  // stacked-area chart. Bucket key shape mirrors `DiscourseTrajectoryMonth.month`
  // and depends on the trajectory's `granularity`: "YYYY-MM" or "YYYY".
  month: string;
  totals: Partial<Record<DiscourseVoice, number>>;
  total: number;
}

export interface DiscourseCoverage {
  totalSubstantive: number;
  codedSubstantive: number;
  firstCodedDate: string | null;
  lastCodedDate: string | null;
  firstSubstantiveDate: string | null;
  lastSubstantiveDate: string | null;
  // Per-year coded fraction across the politician's career — drives the
  // greyed-band overlay on the trajectory chart.
  yearly: Array<{ year: number; total: number; coded: number }>;
}

export interface PersonDiscourseTrajectoryPayload {
  personId: string;
  // Currently rendered year. `null` is the career-wide default (no `?year=`
  // in the URL); a number selects a specific year drilldown.
  selectedYear: number | null;
  // "month": monthly buckets within `selectedYear`. "year": yearly buckets
  // across the politician's full career when no year is selected.
  granularity: "month" | "year";
  // First / last career years with substantive activity (any speeches),
  // populated even when no codings exist. Drives the scatter's x-axis range
  // when `selectedYear` is null.
  firstActiveYear: number | null;
  lastActiveYear: number | null;
  monthly: DiscourseTrajectoryMonth[];
  speechDots: DiscourseSpeechDot[];
  voiceMix: DiscourseVoiceMix[];
  topMarkerKinds: DiscourseTopMarker[];
  coverage: DiscourseCoverage;
  producerLabel: string | null;
}

// ---------------------------------------------------------------------------
// /statistici — Phase 4 stats-page payloads.

export interface DiscourseSystemMonth {
  // "YYYY-MM"
  month: string;
  total: number;
  hge1: number;
  vge1: number;
  hge2: number;
  vge2: number;
}

export interface DiscourseSystemTimeSeries {
  // null = aggregated across all coded years (no year filter applied).
  year: number | null;
  monthly: DiscourseSystemMonth[];
}

export interface DiscourseHvCrosstabCell {
  h: 0 | 1 | 2;
  v: 0 | 1 | 2;
  count: number;
}

export interface DiscourseHvCrosstab {
  year: number | null;
  total: number;
  cells: DiscourseHvCrosstabCell[];
  // The "illiberal cluster" cell count (H=2 + V≥1) — for the panel headline.
  illiberalCount: number;
}

export interface DiscourseTopPolitician {
  personId: string;
  name: string;
  // Party group sampled from the politician's most recent coded speech (e.g.
  // "PSD", "AUR", "Neafiliat"). null when the upstream record is missing the
  // field.
  party: string | null;
  speechCount: number;
  ge1Count: number;
  ge1Rate: number;
  // Wilson 95% CI on the rate. Frontend renders the bracket; methodology
  // disclaimer notes the approximation.
  ciLow: number;
  ciHigh: number;
}

// `dqi-clean` is the orthogonal view: DQI ≥ L2 AND Hawkins.score = 0 AND
// V-Party.score = 0. Frameworks are independent by methodology (schema Q2),
// so a populist speech can also score high on DQI; this panel surfaces the
// subset that does NOT carry populist or anti-pluralist framing in the same
// turn.
export interface DiscourseTopPoliticiansPayload {
  axis: "hawkins" | "vparty" | "dqi" | "dqi-clean";
  year: number | null;
  rows: DiscourseTopPolitician[];
}

export interface DiscourseMarkerTreemapItem {
  framework: DiscourseFramework;
  kind: string;
  count: number;
}

export interface DiscourseMarkerTreemap {
  year: number | null;
  items: DiscourseMarkerTreemapItem[];
  total: number;
}

export interface PersonActivityWindow {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export interface PersonYearCount {
  year: number;
  count: number;
}

export interface PersonPagePayload {
  person: MoPerson;
  recentSpeeches: MoSpeech[];
  stats: PersonStats;
  activity: PersonActivityDay[];
  activityWindow: PersonActivityWindow | null;
  // Per-year substantive speech totals (sparse — only years with ≥1 speech).
  // Sorted ascending by year. Drives the year sparkbar above the heatmap.
  yearlyCounts: PersonYearCount[];
  // The calendar year currently rendered in the heatmap. When the page is
  // hit without `?year=`, this is the year of `stats.last_speech_date`.
  selectedYear: number | null;
  // The day currently filtered (`?day=YYYY-MM-DD`). When set, the heatmap
  // marks that cell and `recentSpeeches` is narrowed to that single day.
  selectedDate: string | null;
  // Total substantive-speech count matching the current filter (year/day).
  // Used to label the speeches section ("X discursuri") when filtered.
  filteredSpeechTotal: number;
  // Pagination state for `recentSpeeches`. The day-filter view is exhaustive
  // (single page, larger size cap) so `totalPages === 1` there even when the
  // sitting has more speeches than fit; year / no-filter views paginate.
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SessionYearCount {
  year: number;
  count: number;
}

// Same shape as SessionYearCount; aliased here so call sites read clearly.
// Counts the number of substantive speeches with a populated `speaker.person_id`
// for that calendar year — i.e. the universe being ranked on `/politicieni`.
export interface PoliticianYearCount {
  year: number;
  count: number;
}

export interface PoliticianRankRow {
  // The full person record from `mo-persons`. `null` when the speeches index
  // references a person_id that hasn't (yet) been registered — rare in normal
  // operation, surfaces during transitional reindex windows.
  person: MoPerson | null;
  personId: string;
  // Speech bucket's `top_hits` sample — the most recent name spelling used in
  // a speech for this person_id. Used as the row label when `person` is null.
  fallbackName: string;
  speechCount: number;
  firstSpeechDate: string | null;
  lastSpeechDate: string | null;
}

export interface PoliticiansIndexPayload {
  // Per-year totals of speeches with a populated `speaker.person_id` (filtered
  // to substantive when `substantiveOnly` is true). Drives the year sparkbar;
  // reflects the universe being ranked.
  yearlyCounts: PoliticianYearCount[];
  // Top politicians by speech count, descending. Capped at 100 — the long tail
  // is reachable via search.
  topPersons: PoliticianRankRow[];
  // Calendar year currently filtered. Defaults to the most recent active year
  // when the page is hit without `?year=`.
  selectedYear: number | null;
  // Whether the rank/agg pipeline filtered to `is_substantive: true`. Default
  // is true (matches the layer-wide public default); set to false via the
  // `?mode=all` query param on /politicieni to widen the universe.
  substantiveOnly: boolean;
  // Every record in `mo-persons` regardless of speech linkage. Surfaces in the
  // footer note ("X persoane indexate") so users know the registry is bigger
  // than the rank list.
  totalRegistryPersons: number;
  // Distinct persons with ≥1 speech in the selected scope (filtered to
  // substantive when `substantiveOnly` is true).
  linkedPersonsInScope: number;
  // Total speeches in the selected scope. Surfaces in the footer note alongside
  // `linkedPersonsInScope`.
  speechesInScope: number;
}

export interface SessionsIndexPayload {
  // Per-year session totals across the entire archive. Sparse (skips year=0
  // legacy parse failures) and sorted ascending. Drives the year sparkbar.
  yearlyCounts: SessionYearCount[];
  // Documents for `selectedYear`, sorted by session_date desc with issue desc
  // as a tiebreaker. Empty array when the archive has no sessions for the
  // requested year (e.g. `?year=1850`).
  sessions: MoDocument[];
  // The calendar year currently listed. Defaults to the most recent year with
  // at least one session when no `?year=` is passed.
  selectedYear: number | null;
  // Sum of `yearlyCounts` — the archive-wide session total surfaced in the
  // page header.
  archiveSessionTotal: number;
}

// Same shape as the other registries; aliased so call sites read clearly.
// Counts the number of meetings per calendar year across `mo-committee-meetings`.
export interface CommitteeYearCount {
  year: number;
  count: number;
}

export interface CommitteeRankRow {
  committeeId: string;
  // Most-recent meeting carries the freshest spelling of the committee name —
  // upstream renames are propagated forward, so the latest meeting is the
  // canonical source. Falls back to `committeeId` when the index is empty.
  name: string;
  kind: string | null;
  // `joint_with[]` from the most recent meeting. Most committees never join;
  // `null` keeps the row terse when there's nothing to render.
  jointWith: string[] | null;
  meetingCount: number;
  firstMeetingDate: string | null;
  lastMeetingDate: string | null;
}

export interface CommitteesIndexPayload {
  // Per-year meeting totals across the whole archive. Sparse, sorted asc.
  yearlyCounts: CommitteeYearCount[];
  // Top committees by meeting count for the selected year, descending. Capped
  // at 100 — the long tail is reachable via committee-id deep links.
  topCommittees: CommitteeRankRow[];
  // Calendar year currently filtered. Defaults to the most recent active year.
  selectedYear: number | null;
  // Distinct committees ever seen in `mo-committee-meetings`, regardless of
  // year. Surfaces in the dateline / footnote.
  totalCommittees: number;
  // Distinct committees with ≥1 meeting in the selected year.
  committeesInScope: number;
  // Total meetings in the selected year — sum of `meetingCount` across the
  // top-N rows is bounded by `committeesInScope`, but the full total can be
  // larger when the rank is truncated.
  meetingsInScope: number;
}

export interface CommitteePagePayload {
  committeeId: string;
  // Header values are derived from the most-recent meeting since there's no
  // upstream `mo-committees` index. Re-aggregated on every cache miss.
  name: string;
  kind: string | null;
  jointWith: string[] | null;
  firstMeetingDate: string | null;
  lastMeetingDate: string | null;
  totalMeetings: number;
  // Per-year meeting counts for this committee. Drives the year sparkbar.
  yearlyCounts: CommitteeYearCount[];
  selectedYear: number | null;
  // Meeting list for `selectedYear`, sorted by meeting_date desc. Capped at
  // 50 to match the layer-wide `MAX_PAGE_SIZE` — committees with denser
  // schedules need an explicit pagination scheme that hasn't shipped yet.
  meetings: MoCommitteeMeeting[];
  // Total meeting count in `selectedYear` (track_total_hits). Equal to
  // `meetings.length` until the cap kicks in.
  meetingsInYear: number;
}
