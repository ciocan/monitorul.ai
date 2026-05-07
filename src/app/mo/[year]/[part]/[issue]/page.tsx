import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Dateline } from "@/components/dateline";
import { env } from "@/env";
import {
  agendaCategoryLabel,
  agendaOutcomeLabel,
  documentTypeLabel,
  formatDate,
  pluralRo,
  sessionTypeLabel,
} from "@/lib/format";
import { isPdfBucketConfigured, pdfKeyForDocument } from "@/lib/pdf";
import { type ChildGrainHit, getDocument, listDocumentChildren } from "@/lib/search";
import type {
  MoAgendaItem,
  MoDocument,
  MoInterpellation,
  MoQuestion,
  MoSpeech,
  MoVote,
} from "@/lib/types";

// SEO commitment per docs/elasticsearch-indexing.md §Q7: every document URL is
// `index, follow`, ISR-cached for 1h, with canonical pointing at the slug-form
// URL minted upstream. Re-extraction reuses the same record_id, so this URL
// stays stable across schema bumps.
export const revalidate = 3600;
export const dynamicParams = true;

interface RouteParams {
  year: string;
  part: string;
  issue: string;
}

interface PageProps {
  params: Promise<RouteParams>;
}

function recordIdFromParams(p: RouteParams): string {
  return `mo://${p.year}/${p.part}/${p.issue}`;
}

function canonicalPathFromParams(p: RouteParams): string {
  return `/mo/${p.year}/${p.part}/${p.issue}`;
}

async function loadDocument(p: RouteParams): Promise<MoDocument | null> {
  return getDocument(recordIdFromParams(p));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const p = await params;
  const doc = await loadDocument(p);
  const canonical = canonicalPathFromParams(p);
  if (!doc) {
    return { title: "Document neidentificat", alternates: { canonical } };
  }
  const dateLabel = formatDate(doc.session_date) ?? doc.year.toString();
  const title = `${documentTypeLabel(doc.document_type)} · ${doc.chamber ?? ""} · ${dateLabel}`;
  const description = doc.summary
    ? doc.summary.slice(0, 280)
    : `${documentTypeLabel(doc.document_type)} din ${dateLabel}, Monitorul Oficial al României, Partea a II-a, numărul ${doc.issue}/${doc.year}.`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "ro_RO",
      url: canonical,
    },
  };
}

export default async function DocumentPage({ params }: PageProps) {
  const p = await params;
  const doc = await loadDocument(p);
  if (!doc) notFound();

  const { agenda, children } = await listDocumentChildren(doc.document_id);
  const sessionDate = formatDate(doc.session_date);
  const publishedDate = formatDate(doc.published);
  const hasBody = children.some((c) => c.grain !== "agenda-items");
  // PDF link is conditional: bucket creds must be configured AND the document
  // must have a `published` date (the bucket key is derived from it). Rather
  // than HEAD-checking the bucket on every render, we trust the upstream
  // pipeline and let the redirect route 404 in the rare case the object is
  // missing. The route handler at `/pdf` mints a fresh signed URL per request.
  const pdfHref =
    isPdfBucketConfigured() && pdfKeyForDocument(doc) ? `${canonicalPathFromParams(p)}/pdf` : null;

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <DocumentJsonLd doc={doc} />

      <Dateline parts={["Monitorul Oficial", `Partea ${doc.part}`, doc.chamber, sessionDate]} />

      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-tight text-ink-16 sm:text-5xl">
          {documentTypeLabel(doc.document_type)}
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-30">{doc.title}</p>
        <dl className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaPair label="Numărul" value={`${doc.issue} / ${doc.year}`} mono />
          <MetaPair label="Data ședinței" value={sessionDate} mono />
          <MetaPair label="Publicat" value={publishedDate} mono />
          <MetaPair
            label="Sesiune"
            value={
              [
                sessionTypeLabel(doc.session_type),
                doc.legislature ? `legislatura ${doc.legislature}` : null,
              ]
                .filter(Boolean)
                .join(", ") || null
            }
          />
        </dl>
        <DocumentCounts doc={doc} />
        {pdfHref ? <PdfDownloadLink href={pdfHref} /> : null}
      </header>

      <section className="mt-10" aria-labelledby="cuprins">
        <h2 id="cuprins" className="label-mono mb-4 text-ink-30">
          Cuprins
        </h2>
        {agenda.length === 0 ? <EmptyAgenda doc={doc} /> : <AgendaList agenda={agenda} />}
      </section>

      {hasBody ? (
        <section className="mt-12" aria-labelledby="stenograma">
          <h2 id="stenograma" className="label-mono mb-6 text-ink-30">
            Stenograma
          </h2>
          <DocumentBody entries={children} />
        </section>
      ) : null}

      <RecordIdentity doc={doc} />
    </article>
  );
}

function MetaPair({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="label-mono text-ink-45">{label}</dt>
      <dd
        className={mono ? "font-mono-meta mt-1 text-sm text-ink-16" : "mt-1 text-sm text-ink-16"}
        data-tabular-nums={mono ? "" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function DocumentCounts({ doc }: { doc: MoDocument }) {
  const counts = [
    {
      key: "agenda",
      n: doc.agenda_count,
      one: "punct pe ordinea de zi",
      few: "puncte pe ordinea de zi",
      many: "de puncte pe ordinea de zi",
    },
    {
      key: "speech",
      n: doc.speech_count,
      one: "discurs",
      few: "discursuri",
      many: "de discursuri",
    },
    { key: "vote", n: doc.vote_count, one: "vot", few: "voturi", many: "de voturi" },
    {
      key: "interp",
      n: doc.interpellation_count,
      one: "interpelare",
      few: "interpelări",
      many: "de interpelări",
    },
    {
      key: "question",
      n: doc.question_count,
      one: "întrebare scrisă",
      few: "întrebări scrise",
      many: "de întrebări scrise",
    },
    {
      key: "committee",
      n: doc.committee_count,
      one: "ședință de comisie",
      few: "ședințe de comisie",
      many: "de ședințe de comisie",
    },
    { key: "report", n: doc.report_count, one: "raport", few: "rapoarte", many: "de rapoarte" },
  ].filter((c) => c.n > 0);
  if (counts.length === 0) return null;
  return (
    <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 label-mono text-ink-30">
      {counts.map((c) => (
        <li key={c.key} className="flex items-baseline gap-2">
          <span className="font-mono-meta text-sm text-ink-16" data-tabular-nums="">
            {c.n}
          </span>
          <span>{pluralRo(c.n, c.one, c.few, c.many).replace(/^\d+\s/, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function PdfDownloadLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="group/pdf mt-8 inline-flex items-center gap-3 border border-border bg-paper-99 px-4 py-3 text-ink-16 transition-colors hover:bg-paper-96 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-30"
    >
      <FileText className="size-4 text-ink-45 transition-colors group-hover/pdf:text-ink-16" />
      <span className="label-mono text-ink-16">Vezi PDF original</span>
      <span aria-hidden className="font-mono-meta text-xs text-ink-45">
        ↗
      </span>
    </a>
  );
}

function AgendaList({ agenda }: { agenda: MoAgendaItem[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {agenda.map((item) => {
        // In-page anchor — the dedicated /agenda/<ord> route ships in a later
        // phase. Until then, jumping to the inline section keeps the Cuprins
        // useful as a table of contents.
        const href = `#agenda-${item.ordinal}`;
        return (
          <li key={item.record_id}>
            <Link
              href={href}
              className="group/row block px-1 py-5 transition-colors hover:bg-paper-96"
            >
              <div className="flex items-baseline gap-4">
                <span
                  className="font-mono-meta w-10 shrink-0 text-sm text-ink-45"
                  data-tabular-nums=""
                >
                  {String(item.ordinal).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-snug text-ink-16 group-hover/row:underline underline-offset-4">
                    {item.title}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 label-mono text-ink-45">
                    {agendaCategoryLabel(item.category) ? (
                      <span>{agendaCategoryLabel(item.category)}</span>
                    ) : null}
                    {agendaOutcomeLabel(item.outcome) ? (
                      <span>{agendaOutcomeLabel(item.outcome)}</span>
                    ) : null}
                    {item.refs.bills.length > 0 ? (
                      <span>
                        {pluralRo(
                          item.refs.bills.length,
                          "proiect citat",
                          "proiecte citate",
                          "de proiecte citate",
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

// Renders the document playback in source order. ES sorts children by
// `position_in_document` ASC, so each agenda item appears immediately before
// its speeches / votes / interpellations / questions. We open a new section at
// every agenda boundary; everything else gets a grain-specific block.
function DocumentBody({ entries }: { entries: ChildGrainHit[] }) {
  type Section = { agenda: MoAgendaItem | null; entries: ChildGrainHit[] };
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const child of entries) {
    if (child.grain === "agenda-items") {
      current = { agenda: child, entries: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { agenda: null, entries: [] };
      sections.push(current);
    }
    current.entries.push(child);
  }
  return (
    <div className="space-y-12">
      {sections.map((section, i) => (
        <AgendaSection
          key={section.agenda?.record_id ?? `orphan-${i}`}
          agenda={section.agenda}
          entries={section.entries}
        />
      ))}
    </div>
  );
}

function AgendaSection({
  agenda,
  entries,
}: {
  agenda: MoAgendaItem | null;
  entries: ChildGrainHit[];
}) {
  const speechCount = entries.filter((e) => e.grain === "speeches").length;
  const anchorId = agenda ? `agenda-${agenda.ordinal}` : undefined;
  return (
    <section
      id={anchorId}
      aria-labelledby={anchorId ? `${anchorId}-title` : undefined}
      className="scroll-mt-20"
    >
      {agenda ? (
        <header className="border-t-2 border-ink-16 pt-4">
          <p className="label-mono text-ink-45">
            <span className="font-mono-meta text-ink-30" data-tabular-nums="">
              {String(agenda.ordinal).padStart(2, "0")}
            </span>
            {agendaCategoryLabel(agenda.category) ? (
              <> · {agendaCategoryLabel(agenda.category)}</>
            ) : null}
            {agendaOutcomeLabel(agenda.outcome) ? (
              <> · {agendaOutcomeLabel(agenda.outcome)}</>
            ) : null}
          </p>
          <h3
            id={anchorId ? `${anchorId}-title` : undefined}
            className="font-display mt-2 text-2xl leading-snug text-ink-16"
          >
            {agenda.title}
          </h3>
          {speechCount > 0 ? (
            <p className="mt-3 label-mono text-ink-45">
              {pluralRo(speechCount, "discurs", "discursuri", "de discursuri")}
            </p>
          ) : null}
        </header>
      ) : null}
      <ol className="mt-6 divide-y divide-border border-y border-border">
        {entries.map((entry) => (
          <BodyEntry key={entry.record_id} entry={entry} />
        ))}
      </ol>
    </section>
  );
}

function BodyEntry({ entry }: { entry: ChildGrainHit }) {
  switch (entry.grain) {
    case "speeches":
      return <SpeechBlock speech={entry} />;
    case "votes":
      return <VoteBlock vote={entry} />;
    case "interpellations":
      return <InterpellationBlock item={entry} />;
    case "questions":
      return <QuestionBlock item={entry} />;
    default:
      return null;
  }
}

function speakerLine(speech: MoSpeech): string {
  const { speaker } = speech;
  const name = speaker.name_search || speaker.name_raw;
  const title = speaker.title?.trim();
  return title ? `${title} ${name}` : name;
}

function SpeechBlock({ speech }: { speech: MoSpeech }) {
  const anchorId = `discurs-${speech.position_in_document ?? speech.position_in_agenda}`;
  const meta = [
    speech.speaker.role,
    speech.speaker.party_group_at_time,
    speech.speaker.delivery_mode === "written" ? "intervenție scrisă" : null,
  ].filter(Boolean);
  // `speaker.person_id` is the same string as the person record's `slug` —
  // both are minted upstream from the canonical name. Verified against the
  // live `mo-persons` index. Today only ~20% of speeches have person_id
  // populated (upstream backfill is in progress), so most names render as
  // plain text; links appear automatically as the backfill catches up.
  const personSlug = speech.speaker.person_id;
  const speaker = speakerLine(speech);
  return (
    <li
      id={anchorId}
      className="scroll-mt-20 px-1 py-6 target:bg-paper-96 target:-mx-1 target:px-2"
    >
      <p className="font-mono text-base font-semibold leading-tight text-ink-16">
        {personSlug ? (
          <Link
            href={`/politicieni/${personSlug}`}
            className="underline decoration-paper-91 underline-offset-4 hover:decoration-ink-30"
          >
            {speaker}
          </Link>
        ) : (
          speaker
        )}
      </p>
      {meta.length > 0 ? <p className="mt-1 label-mono text-ink-45">{meta.join(" · ")}</p> : null}
      {speech.text ? (
        <div className="mt-3 max-w-prose space-y-3 text-base leading-relaxed text-ink-30">
          {speech.text
            .split(/\n\n+/)
            .map((para, i) => (para.trim() ? <p key={i}>{para.trim()}</p> : null))}
        </div>
      ) : null}
    </li>
  );
}

function VoteBlock({ vote }: { vote: MoVote }) {
  const counts = vote.counts;
  const summary = [
    counts.for_unanimous ? "unanim pentru" : counts.for != null ? `${counts.for} pentru` : null,
    counts.against != null ? `${counts.against} contra` : null,
    counts.abstain != null ? `${counts.abstain} abțineri` : null,
  ].filter(Boolean);
  return (
    <li className="px-1 py-5">
      <p className="label-mono text-ink-45">
        Vot{agendaOutcomeLabel(vote.outcome) ? ` · ${agendaOutcomeLabel(vote.outcome)}` : ""}
      </p>
      <p className="mt-2 text-sm font-semibold leading-snug text-ink-16">{vote.agenda_title}</p>
      {summary.length > 0 ? (
        <p className="font-mono-meta mt-2 text-sm text-ink-30" data-tabular-nums="">
          {summary.join(" · ")}
        </p>
      ) : null}
    </li>
  );
}

function InterpellationBlock({ item }: { item: MoInterpellation }) {
  return (
    <li className="px-1 py-5">
      <p className="label-mono text-ink-45">Interpelare</p>
      <p className="mt-2 font-mono text-base font-semibold leading-tight text-ink-16">
        {item.questioner.name}
      </p>
      {item.topic ? <p className="mt-2 text-sm text-ink-30">{item.topic}</p> : null}
      {item.question_text ? (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-30">{item.question_text}</p>
      ) : null}
    </li>
  );
}

function QuestionBlock({ item }: { item: MoQuestion }) {
  return (
    <li className="px-1 py-5">
      <p className="label-mono text-ink-45">
        Întrebare scrisă{item.regnum ? ` · ${item.regnum}` : ""}
      </p>
      <p className="mt-2 font-mono text-base font-semibold leading-tight text-ink-16">
        {item.questioner.name}
      </p>
      {item.topic ? <p className="mt-2 text-sm text-ink-30">{item.topic}</p> : null}
    </li>
  );
}

function EmptyAgenda({ doc }: { doc: MoDocument }) {
  return (
    <div className="border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm text-ink-30">
        Niciun punct pe ordinea de zi nu a fost extras pentru acest document. Acesta este de obicei
        cazul pentru sintezele comisiilor și rapoartele instituționale, unde conținutul este
        organizat la nivel de ședință sau secțiune.
      </p>
      {doc.committee_count > 0 ? (
        <p className="mt-3 text-sm text-ink-30">
          Documentul conține{" "}
          {pluralRo(
            doc.committee_count,
            "ședință de comisie",
            "ședințe de comisie",
            "de ședințe de comisie",
          )}{" "}
          — vor putea fi navigate într-o etapă următoare.
        </p>
      ) : null}
    </div>
  );
}

function RecordIdentity({ doc }: { doc: MoDocument }) {
  return (
    <aside className="mt-16 border-t border-border pt-6">
      <p className="label-mono text-ink-45">Identitatea înregistrării</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-12 gap-y-3 font-mono-meta text-xs text-ink-45 sm:grid-cols-2">
        <div>
          <dt className="inline text-ink-30">record_id:</dt>{" "}
          <dd className="inline">{doc.record_id}</dd>
        </div>
        <div>
          <dt className="inline text-ink-30">content_fingerprint:</dt>{" "}
          <dd className="inline">{doc.content_fingerprint}</dd>
        </div>
        <div>
          <dt className="inline text-ink-30">schema_version:</dt>{" "}
          <dd className="inline">{doc.schema_version}</dd>
        </div>
        <div>
          <dt className="inline text-ink-30">indexed_at:</dt>{" "}
          <dd className="inline">{doc.indexed_at}</dd>
        </div>
      </dl>
    </aside>
  );
}

// Per docs/elasticsearch-indexing.md §Q7: documents emit Article + GovernmentService.
// We render them as a @graph so a single <script> tag carries both nodes.
function DocumentJsonLd({ doc }: { doc: MoDocument }) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/mo/${doc.year}/${doc.part}/${doc.issue}`;
  const datePublished = doc.published ?? doc.session_date ?? `${doc.year}-01-01`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: doc.title,
        datePublished,
        dateModified: doc.indexed_at,
        inLanguage: "ro",
        isPartOf: {
          "@type": "PublicationIssue",
          issueNumber: doc.issue,
          datePublished,
          isPartOf: {
            "@type": "Periodical",
            name: "Monitorul Oficial al României, Partea a II-a",
          },
        },
        url,
      },
      {
        "@type": "GovernmentService",
        "@id": `${url}#service`,
        name: doc.title,
        serviceType: documentTypeLabel(doc.document_type),
        provider: {
          "@type": "GovernmentOrganization",
          name: doc.chamber ?? "Parlamentul României",
        },
        audience: { "@type": "Audience", audienceType: "Public" },
        url,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD is rendered to the SSR HTML head; the < replacement is the
      // XSS hardening recommended by Next.js (docs: app/guides/json-ld).
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
