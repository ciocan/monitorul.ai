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

export interface PersonPagePayload {
  person: MoPerson;
  recentSpeeches: MoSpeech[];
  stats: PersonStats;
}
