import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { SpeechViewedTracker } from "@/components/analytics/page-trackers";
import { Dateline } from "@/components/dateline";
import { DiscourseSidePanel } from "@/components/discourse/discourse-side-panel";
import { InlineMarkerOverlay } from "@/components/discourse/inline-marker-overlay";
import { MarkerLinkCoordinator } from "@/components/discourse/marker-link-coordinator";
import { SpeechDiscourseSummary } from "@/components/discourse/speech-discourse-summary";
import { SpeechLengthMeter } from "@/components/speech-length-meter";
import { env } from "@/env";
import { speechWordCountBucket } from "@/lib/analytics";
import { parseDiscourseParams } from "@/lib/discourse-params";
import { prepareOverlay } from "@/lib/discourse-markers";
import {
  agendaCategoryLabel,
  agendaOutcomeLabel,
  formatDate,
  speechExcerpt,
  speechWordCount,
} from "@/lib/format";
import { getSpeechBySlug } from "@/lib/search";
import type { MoSpeech } from "@/lib/types";

// Per `../monitorul/docs/elasticsearch-indexing.md` §Q7: substantive speeches
// are `index, follow` and citation-grade; non-substantive turns (chair
// procedure, sub-100-char interjections) drop to `noindex, follow` so they
// stay reachable but don't dilute domain ranking signal. ISR 1h matches the
// rest of the archive surface; `dynamicParams: true` because the speech
// corpus is too large (~948K records) to prebuild.
export const revalidate = 3600;
export const dynamicParams = true;

interface RouteParams {
  slug: string;
}

interface PageProps {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface DocCoord {
  year: string;
  part: string;
  issue: string;
}

const DOCUMENT_ID_RE = /^mo:\/\/([^/]+)\/([^/]+)\/(.+)$/;
function parseDocumentId(id: string): DocCoord | null {
  const m = DOCUMENT_ID_RE.exec(id);
  return m ? { year: m[1], part: m[2], issue: m[3] } : null;
}

function speakerLine(speech: MoSpeech): string {
  const { speaker } = speech;
  const name = speaker.name_search || speaker.name_raw;
  const title = speaker.title?.trim();
  return title ? `${title} ${name}` : name;
}

function deliveryModeLabel(mode: string | null | undefined): string | null {
  if (!mode) return null;
  if (mode === "written") return "intervenție scrisă";
  if (mode === "spoken") return null;
  return mode;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const speech = await getSpeechBySlug(slug);
  const canonical = speech ? speech.url_path : `/discurs/${slug}`;
  if (!speech) {
    return {
      title: "Discurs neidentificat",
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }
  const speaker = speakerLine(speech);
  const dateLabel = formatDate(speech.session_date);
  const titleParts = [speaker, dateLabel].filter(Boolean);
  const title = titleParts.length > 0 ? titleParts.join(" · ") : "Discurs";
  const description = speechExcerpt(speech.text, 280) ?? speech.agenda_title;
  return {
    title,
    description,
    alternates: { canonical },
    robots: speech.is_substantive ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description: description ?? undefined,
      type: "article",
      locale: "ro_RO",
      url: canonical,
    },
  };
}

export default async function SpeechPage({ params, searchParams }: PageProps) {
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams]);
  const speech = await getSpeechBySlug(slug);
  if (!speech) notFound();
  const discourseParams = parseDiscourseParams(rawSearch);
  const sp = new URLSearchParams();
  if (discourseParams.voiceMode === "all") sp.set("voice", "all");
  if (discourseParams.confidenceMin === 0.7) sp.set("conf", "07");
  const overlay = prepareOverlay(speech, discourseParams);
  const discourse = speech.enrichments?.discourse ?? null;
  const producerLabel = speech.enrichments?.discourse_producer ?? null;
  // Slug-once: when the requested slug differs from the canonical one persisted
  // upstream, 308-redirect so search engines collapse the variant. The server
  // matches on the trailing `<short_id>` only (see `getSpeechBySlug` fallback);
  // the canonical `url_path` is what we redirect to.
  if (speech.slug !== slug) {
    permanentRedirect(speech.url_path);
  }

  const doc = parseDocumentId(speech.document_id);
  const sessionDate = formatDate(speech.session_date);
  const agendaAnchor = doc
    ? `/mo/${doc.year}/${doc.part}/${doc.issue}#agenda-${speech.agenda_ordinal}`
    : null;
  const speechAnchor = doc
    ? `/mo/${doc.year}/${doc.part}/${doc.issue}#discurs-${speech.position_in_document ?? speech.position_in_agenda}`
    : null;
  const speaker = speakerLine(speech);
  const personSlug = speech.speaker.person_id;
  const wordCount = speechWordCount(speech.text);
  const speakerMeta = [
    speech.speaker.role,
    speech.speaker.party_group_at_time,
    deliveryModeLabel(speech.speaker.delivery_mode),
  ].filter((p): p is string => Boolean(p));
  const agendaMeta = [
    agendaCategoryLabel(speech.agenda_category),
    agendaOutcomeLabel(speech.agenda_outcome),
  ].filter((p): p is string => Boolean(p));
  const billRefs = speech.refs?.bills ?? [];

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <SpeechJsonLd speech={speech} />
      <SpeechViewedTracker
        has_speaker={Boolean(personSlug)}
        has_discourse={Boolean(discourse)}
        is_substantive={speech.is_substantive}
        word_count_bucket={speechWordCountBucket(wordCount)}
      />

      <Dateline
        parts={[
          "Monitorul Oficial",
          doc ? `Partea ${doc.part}` : null,
          speech.chamber,
          sessionDate,
        ]}
      />

      <header className="mt-6 border-b border-border pb-8">
        {agendaMeta.length > 0 ? (
          <p className="label-mono text-ink-45">{agendaMeta.join(" · ")}</p>
        ) : null}
        <h1 className="font-display mt-2 text-4xl leading-tight text-ink-16 sm:text-5xl">
          {personSlug ? (
            <Link
              href={`/politicieni/${personSlug}`}
              className="underline decoration-paper-91 underline-offset-8 hover:decoration-ink-30"
            >
              {speaker}
            </Link>
          ) : (
            speaker
          )}
        </h1>
        {speakerMeta.length > 0 ? (
          <p className="mt-3 label-mono text-ink-45">{speakerMeta.join(" · ")}</p>
        ) : null}
        {speech.agenda_title ? (
          // Long parliamentary titles ("Informare privind…") run six lines
          // unchecked. Clamp to three; `-webkit-line-clamp` handles the
          // trailing ellipsis automatically.
          <p className="mt-4 line-clamp-3 max-w-prose text-base leading-relaxed text-ink-30">
            {agendaAnchor ? (
              <Link
                href={agendaAnchor}
                className="underline decoration-paper-91 underline-offset-4 hover:decoration-ink-30"
              >
                {speech.agenda_title}
              </Link>
            ) : (
              speech.agenda_title
            )}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-3">
          {wordCount > 0 ? <SpeechLengthMeter wordCount={wordCount} /> : null}
          {!speech.is_substantive ? (
            <p className="label-mono text-ink-45">Intervenție procedurală</p>
          ) : null}
        </div>
      </header>

      {discourse ? (
        <section className="mt-10" aria-labelledby="discurs-summary">
          <h2 id="discurs-summary" className="label-mono mb-3 text-ink-30">
            Analiza discursului
          </h2>
          <SpeechDiscourseSummary discourse={discourse} producerLabel={producerLabel} />
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="discurs">
        <h2 id="discurs" className="label-mono mb-6 text-ink-30">
          Discurs
        </h2>
        {discourse && speech.text ? (
          <MarkerLinkCoordinator className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <InlineMarkerOverlay paragraphs={overlay.paragraphs} />
            <DiscourseSidePanel
              markers={overlay.visibleMarkers}
              totalMarkers={overlay.totalMarkers}
              basePath={speech.url_path}
              searchParams={sp}
              params={discourseParams}
            />
          </MarkerLinkCoordinator>
        ) : speech.text ? (
          <>
            <div className="max-w-prose space-y-4 text-base leading-relaxed text-ink-30">
              {speech.text
                .split(/\n\n+/)
                .map((para, i) => (para.trim() ? <p key={i}>{para.trim()}</p> : null))}
            </div>
            <p className="mt-6 max-w-prose text-xs leading-relaxed text-ink-45">
              Acest discurs nu este încă acoperit de analiza de discurs (acoperire curentă: 2020 →).{" "}
              <Link
                href="/despre/discurs"
                className="underline decoration-paper-91 underline-offset-2 hover:text-ink-30 hover:decoration-ink-30"
              >
                Vezi metodologia
              </Link>
              .
            </p>
          </>
        ) : (
          <p className="max-w-prose text-sm leading-relaxed text-ink-45">
            Textul stenogramei nu este disponibil pentru această intervenție.
          </p>
        )}
      </section>

      {billRefs.length > 0 ? (
        <section className="mt-10" aria-labelledby="referinte">
          <h2 id="referinte" className="label-mono mb-3 text-ink-30">
            Referințe
          </h2>
          <ul className="font-mono-meta flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-30">
            {billRefs.map((bill) => (
              <li key={bill} data-tabular-nums="">
                {bill}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {speechAnchor ? (
        <section className="mt-12 border-t border-border pt-6">
          <Link
            href={speechAnchor}
            className="group/link inline-flex items-baseline gap-2 label-mono text-ink-30 hover:text-ink-16"
          >
            <span>În contextul ședinței</span>
            <ArrowRight
              aria-hidden="true"
              className="size-3 translate-y-px transition-transform group-hover/link:translate-x-0.5"
            />
          </Link>
        </section>
      ) : null}

      <RecordIdentity speech={speech} />
    </article>
  );
}

function RecordIdentity({ speech }: { speech: MoSpeech }) {
  return (
    <aside className="mt-16 border-t border-border pt-6">
      <p className="label-mono text-ink-45">Identitatea înregistrării</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-12 gap-y-3 font-mono-meta text-xs text-ink-45 sm:grid-cols-2">
        <div>
          <dt className="inline text-ink-30">record_id:</dt>{" "}
          <dd className="inline">{speech.record_id}</dd>
        </div>
        <div>
          <dt className="inline text-ink-30">content_fingerprint:</dt>{" "}
          <dd className="inline">{speech.content_fingerprint}</dd>
        </div>
        <div>
          <dt className="inline text-ink-30">schema_version:</dt>{" "}
          <dd className="inline">{speech.schema_version}</dd>
        </div>
        <div>
          <dt className="inline text-ink-30">indexed_at:</dt>{" "}
          <dd className="inline">{speech.indexed_at}</dd>
        </div>
      </dl>
    </aside>
  );
}

// Per `../monitorul/docs/elasticsearch-indexing.md` §Q7: speeches emit
// `Quotation` + `Person` (speaker, with `sameAs: <wikidata_qid>` when known)
// + `isPartOf` (parent `Article`). We render them as a `@graph` so a single
// `<script>` tag carries every node. Only `is_substantive: true` speeches are
// citation-grade; non-substantive turns still emit JSON-LD so any caller that
// follows their canonical link gets structured metadata, but the page itself
// signals `noindex, follow` upstream of this.
function SpeechJsonLd({ speech }: { speech: MoSpeech }) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}${speech.url_path}`;
  const datePublished = speech.session_date ?? `${speech.year}-01-01`;
  const speakerName = speakerLine(speech);
  const personSlug = speech.speaker.person_id;
  const personUrl = personSlug ? `${env.NEXT_PUBLIC_SITE_URL}/politicieni/${personSlug}` : null;
  const doc = parseDocumentId(speech.document_id);
  const docUrl = doc ? `${env.NEXT_PUBLIC_SITE_URL}/mo/${doc.year}/${doc.part}/${doc.issue}` : null;

  const personNode: Record<string, unknown> = {
    "@type": "Person",
    name: speakerName,
  };
  if (personUrl) {
    personNode["@id"] = `${personUrl}#person`;
    personNode.url = personUrl;
  }

  const quotation: Record<string, unknown> = {
    "@type": "Quotation",
    "@id": `${url}#quotation`,
    text: speech.text ?? speech.agenda_title,
    datePublished,
    inLanguage: "ro",
    creator: personNode,
    url,
  };
  if (speech.agenda_title) quotation.about = speech.agenda_title;
  if (docUrl) {
    quotation.isPartOf = {
      "@type": "Article",
      "@id": `${docUrl}#article`,
      url: docUrl,
    };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [quotation, personNode],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
