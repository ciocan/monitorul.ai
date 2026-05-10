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
     */
    discourse?: {
      hawkins?: {
        score: 0 | 1 | 2;
        framework_confidence: number;
        marker_count: number;
        marker_kinds?: string[];
      };
      vparty?: {
        score: 0 | 1 | 2;
        framework_confidence: number;
        marker_count: number;
        marker_kinds?: string[];
      };
      voice?: {
        dominant_voice: string;
        voices_seen: string[];
      };
      dqi?: {
        level_of_justification: 0 | 1 | 2 | 3;
        content_of_justification: "none" | "group_interest" | "common_good" | "mixed";
        respect_for_groups: 0 | 1 | 2;
        respect_for_demands: 0 | 1 | 2;
        respect_for_counterarguments: 0 | 1 | 2;
        constructive_politics: "positional" | "alternative_proposal" | "mediating_proposal";
      };
    };
    discourse_producer?: string;
    discourse_text_fingerprint?: string;
  };
  slug: string;
  url_path: string;
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
