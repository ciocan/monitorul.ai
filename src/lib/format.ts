import type { DocumentType } from "@/lib/types";

const COUNT_FMT = new Intl.NumberFormat("ro-RO");

export function formatCount(n: number): string {
  return COUNT_FMT.format(n);
}

const DATE_FMT = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const DATE_SHORT_FMT = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return DATE_FMT.format(d);
}

export function formatDateShort(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return DATE_SHORT_FMT.format(d);
}

const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  plenary_stenogram: "Stenogramă plen",
  plenary_joint_session: "Ședință comună a Camerelor",
  committee_synthesis: "Sinteza comisiilor",
  question_register: "Registrul întrebărilor scrise",
  report_facsimile: "Raport instituțional",
};

export function documentTypeLabel(t: DocumentType | null | undefined): string {
  if (!t) return "Document";
  return DOCUMENT_TYPE_LABEL[t] ?? t;
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  ordinary: "sesiune ordinară",
  extraordinary: "sesiune extraordinară",
  special: "sesiune specială",
};

export function sessionTypeLabel(t: string | null | undefined): string | null {
  if (!t) return null;
  return SESSION_TYPE_LABEL[t] ?? t;
}

const AGENDA_CATEGORY_LABEL: Record<string, string> = {
  commemorative: "Comemorativ",
  notification: "Informare",
  bill_first_reading: "Proiect de lege, prima lectură",
  bill_debate: "Dezbatere proiect de lege",
  final_vote: "Vot final",
  declaration: "Declarații politice",
  political_declarations: "Declarații politice",
  eu_consultation: "Consultare europeană",
  question_hour: "Ora întrebărilor",
  interpellation_hour: "Ora interpelărilor",
  procedure: "Procedură",
};

export function agendaCategoryLabel(c: string | null | undefined): string | null {
  if (!c) return null;
  // Some upstream records carry the category as space-separated lowercase
  // ("political declarations") rather than snake_case; normalise so both
  // shapes resolve to the same Romanian label.
  const key = c.toLowerCase().replace(/\s+/g, "_");
  return AGENDA_CATEGORY_LABEL[key] ?? c.replace(/_/g, " ");
}

const AGENDA_OUTCOME_LABEL: Record<string, string> = {
  adopted: "Adoptat",
  rejected: "Respins",
  withdrawn: "Retras",
  deferred: "Amânat",
  votul_final_deferred: "Trimis la votul final",
  informational: "Informativ",
  in_progress: "În desfășurare",
};

export function agendaOutcomeLabel(o: string | null | undefined): string | null {
  if (!o) return null;
  const key = o.toLowerCase().replace(/\s+/g, "_");
  return AGENDA_OUTCOME_LABEL[key] ?? o.replace(/_/g, " ");
}

export function pluralRo(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count);
  if (abs === 1) return `${count} ${one}`;
  if (abs === 0 || (abs >= 2 && abs <= 19)) return `${count} ${few}`;
  return `${count} ${many}`;
}

// One-line procedural footer for a speech row: category · first bill ref ·
// outcome. Each segment is optional — procedural one-liners may have only a
// category, declarations may have nothing at all (in which case the caller
// should skip rendering the footer rather than show an empty separator).
// Multiple bill refs are not concatenated to keep the line scannable; the
// document page is the destination for the full ref list.
export function speechMeta(speech: {
  agenda_category: string | null;
  agenda_outcome: string | null;
  refs?: { bills?: string[] };
}): string | null {
  const category = agendaCategoryLabel(speech.agenda_category);
  const firstBill = speech.refs?.bills?.[0] ?? null;
  const outcome = agendaOutcomeLabel(speech.agenda_outcome);
  const parts = [category, firstBill, outcome].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Speech bodies are stored as Markdown by the upstream extractor — `##` for
// stenogram section breaks, `**Domnul X:**` for self-attribution, `_…_` for
// italics. The list excerpt should read as plain civic-archive prose, so we
// strip those markers before truncating.
const MD_HEADING_RE = /(^|\s)#{1,6}\s+/g;
const MD_BOLD_AST_RE = /\*\*([^*\n]+?)\*\*/g;
const MD_BOLD_UND_RE = /__([^_\n]+?)__/g;
const MD_ITALIC_AST_RE = /\*([^*\n]+?)\*/g;
const MD_ITALIC_UND_RE = /(^|[^_\w])_([^_\n]+?)_(?![_\w])/g;
// "Domnul Foo Bar:" / "Doamna Foo Bar:" at the start — the politician's own
// turn marker, redundant on their own profile page.
const SPEAKER_PREFIX_RE = /^(?:Domnul|Doamna|Domnișoara)\s+\p{Lu}[\p{L}\s\-.]+?:\s*/u;
const LEADING_PUNCT_RE = /^[,;.:]+\s*/;

// Trim a speech body down to a list-friendly preview. Strips Markdown
// emphasis, collapses whitespace (the extractor preserves stenogram line
// breaks), removes any leading "Domnul X:" speaker self-prefix, then cuts at
// a word boundary close to `max`. Ellipsis is the typographic single
// character `…`, not three dots.
export function speechExcerpt(text: string | null | undefined, max = 240): string | null {
  if (!text) return null;
  // Bold first so `**bold**` isn't partially unwrapped by the italic pass.
  const cleaned = text
    .replace(MD_HEADING_RE, "$1")
    .replace(MD_BOLD_AST_RE, "$1")
    .replace(MD_BOLD_UND_RE, "$1")
    .replace(MD_ITALIC_AST_RE, "$1")
    .replace(MD_ITALIC_UND_RE, "$1$2")
    .replace(/\s+/g, " ")
    // `_word_,` becomes `word ,` after the italic strip — close that gap so
    // the excerpt reads as natural prose.
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
    .replace(SPEAKER_PREFIX_RE, "")
    .replace(LEADING_PUNCT_RE, "")
    .trim();
  if (cleaned.length === 0) return null;
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const sliced = lastSpace > max - 40 ? cut.slice(0, lastSpace) : cut;
  return `${sliced}…`;
}
