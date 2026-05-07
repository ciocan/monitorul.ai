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
  question_hour: "Ora întrebărilor",
  interpellation_hour: "Ora interpelărilor",
  procedure: "Procedură",
};

export function agendaCategoryLabel(c: string | null | undefined): string | null {
  if (!c) return null;
  return AGENDA_CATEGORY_LABEL[c] ?? c.replace(/_/g, " ");
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
  return AGENDA_OUTCOME_LABEL[o] ?? o.replace(/_/g, " ");
}

export function pluralRo(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count);
  if (abs === 1) return `${count} ${one}`;
  if (abs === 0 || (abs >= 2 && abs <= 19)) return `${count} ${few}`;
  return `${count} ${many}`;
}
