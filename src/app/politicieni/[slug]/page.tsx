import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContributionsGraph } from "@/components/contributions-graph";
import { Dateline } from "@/components/dateline";
import { PersonDiscoursePanel } from "@/components/discourse/person-discourse-panel";
import { Pagination } from "@/components/pagination";
import { SpeechLengthMeter } from "@/components/speech-length-meter";
import { YearlyActivityChart } from "@/components/yearly-activity-chart";
import { env } from "@/env";
import { parseDiscourseParams } from "@/lib/discourse-params";
import { formatCount, formatDate, speechExcerpt, speechMeta, speechWordCount } from "@/lib/format";
import { personDiscourseTrajectory, personPage } from "@/lib/search";
import type { DiscourseFramework, Mandate, MoPerson, MoSpeech, PersonStats } from "@/lib/types";

// Person pages are citation-grade archive entries: stable URL, ISR 1h, JSON-LD
// `Person` graph node so the page is harvestable as a public registry record.
export const revalidate = 3600;
export const dynamicParams = true;

interface RouteParams {
  slug: string;
}

interface PageProps {
  params: Promise<RouteParams>;
  searchParams: Promise<{
    year?: string;
    day?: string;
    page?: string;
    fw?: string;
    voice?: string;
    conf?: string;
  }>;
}

const DISCOURSE_FRAMEWORKS: DiscourseFramework[] = ["hawkins", "vparty", "dqi", "voice"];

function parseFrameworkParam(raw: string | undefined): DiscourseFramework {
  if (raw && (DISCOURSE_FRAMEWORKS as string[]).includes(raw)) {
    return raw as DiscourseFramework;
  }
  return "hawkins";
}

// Accepts `2024`, `1995`, etc. Anything outside the parliamentary archive
// range or not parseable as an integer falls back to the default selection
// (most recent active year). Prevents `?year=2099` from doing anything weird.
function parseYearParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1990 || n > 2100) return undefined;
  return n;
}

// Strict YYYY-MM-DD; rejects anything that's not a real calendar date so a
// hand-crafted `?day=2018-13-99` can't poison the heatmap state.
const DAY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseDayParam(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = DAY_SHAPE.exec(raw);
  if (!m) return undefined;
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return undefined;
  return raw;
}

function parsePageParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(n, 1000);
}

function speechesPageHref(slug: string, year: number | undefined, day: string | undefined) {
  return (page: number) => {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (day) params.set("day", day);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/politicieni/${slug}${qs ? `?${qs}` : ""}#discursuri-recente`;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const payload = await personPage(slug);
  const canonical = `/politicieni/${slug}`;
  if (!payload) {
    return { title: "Persoană neidentificată", alternates: { canonical } };
  }
  const { person, stats } = payload;
  const lifespan = activeLifespan(stats, person.mandates);
  const title = `${person.canonical_name}${lifespan ? ` · ${lifespan}` : ""}`;
  const description =
    stats.speech_count > 0
      ? `${person.canonical_name}: ${formatCount(stats.speech_count)} de discursuri în Monitorul Oficial al României, Partea a II-a.`
      : `${person.canonical_name} — fișă în registrul politicienilor extras din Monitorul Oficial al României, Partea a II-a.`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "profile", locale: "ro_RO", url: canonical },
  };
}

export default async function PersonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const year = parseYearParam(sp.year);
  const day = parseDayParam(sp.day);
  const page = parsePageParam(sp.page);
  const framework = parseFrameworkParam(sp.fw);
  const discourseParams = parseDiscourseParams(sp);
  const [payload, trajectory] = await Promise.all([
    personPage(slug, { year, day, page }),
    personDiscourseTrajectory(slug, {
      year,
      voiceMode: discourseParams.voiceMode,
      confidenceMin: discourseParams.confidenceMin,
    }),
  ]);
  if (!payload) notFound();
  const discourseSearchParams = new URLSearchParams();
  if (year) discourseSearchParams.set("year", String(year));
  if (day) discourseSearchParams.set("day", day);
  if (page && page > 1) discourseSearchParams.set("page", String(page));
  if (framework !== "hawkins") discourseSearchParams.set("fw", framework);
  if (discourseParams.voiceMode === "all") discourseSearchParams.set("voice", "all");
  if (discourseParams.confidenceMin === 0.7) discourseSearchParams.set("conf", "07");
  const {
    person,
    stats,
    recentSpeeches,
    activity,
    activityWindow,
    yearlyCounts,
    selectedYear,
    selectedDate,
    filteredSpeechTotal,
    page: currentPage,
    totalPages,
  } = payload;
  const lifespan = activeLifespan(stats, person.mandates);
  const currentMandate = pickCurrentMandate(person.mandates);
  const safePage = Math.min(currentPage, totalPages);
  const speechesHeading = selectedDate
    ? `Discursuri din ${formatDate(selectedDate) ?? selectedDate}`
    : year
      ? `Discursuri din ${year}`
      : "Discursuri recente";

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <PersonJsonLd person={person} />

      <Dateline
        parts={["Registrul politicienilor", currentMandate?.role, currentMandate?.party, lifespan]}
      />

      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-tight text-ink-16 sm:text-5xl">
          {person.canonical_name}
        </h1>
        {person.homonym_disambiguation ? (
          <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-30">
            {person.homonym_disambiguation}
          </p>
        ) : null}
        <PersonMeta person={person} stats={stats} />
      </header>

      {person.mandates.length > 0 ? (
        <section className="mt-10" aria-labelledby="mandate">
          <h2 id="mandate" className="label-mono mb-4 text-ink-30">
            Mandate
          </h2>
          <MandateList mandates={person.mandates} />
        </section>
      ) : null}

      {activityWindow && selectedYear ? (
        <section className="mt-12" aria-labelledby="activitate">
          <h2 id="activitate" className="label-mono mb-4 text-ink-30">
            Activitate
          </h2>
          {yearlyCounts.length > 1 ? (
            <YearlyActivityChart
              yearlyCounts={yearlyCounts}
              selectedYear={selectedYear}
              slug={person.slug}
              className="mb-8"
              stretch
            />
          ) : null}
          <ContributionsGraph
            activity={activity}
            window={activityWindow}
            slug={person.slug}
            selectedDate={selectedDate}
          />
        </section>
      ) : null}

      {trajectory && trajectory.coverage.codedSubstantive > 0 ? (
        <PersonDiscoursePanel
          trajectory={trajectory}
          framework={framework}
          basePath={`/politicieni/${person.slug}`}
          searchParams={discourseSearchParams}
          params={discourseParams}
          className="mt-12"
        />
      ) : null}

      <section className="mt-12" aria-labelledby="discursuri-recente">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="discursuri-recente" className="label-mono scroll-mt-20 text-ink-30">
            {speechesHeading}
          </h2>
          {filteredSpeechTotal > 0 ? (
            <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
              {formatCount(filteredSpeechTotal)}{" "}
              {filteredSpeechTotal === 1 ? "discurs" : "discursuri"}
            </span>
          ) : null}
        </div>
        {recentSpeeches.length === 0 ? (
          <EmptySpeeches selectedDate={selectedDate} selectedYear={year ?? null} />
        ) : (
          <>
            <SpeechesList speeches={recentSpeeches} />
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageHref={speechesPageHref(person.slug, year, day)}
            />
          </>
        )}
      </section>
    </article>
  );
}

function activeLifespan(stats: PersonStats, mandates: Mandate[]): string | null {
  const speechFrom = stats.first_speech_date;
  const speechTo = stats.last_speech_date;
  if (speechFrom || speechTo) {
    const from = speechFrom ? speechFrom.slice(0, 4) : "?";
    const to = speechTo ? speechTo.slice(0, 4) : "?";
    return from === to ? from : `${from}–${to}`;
  }
  // Fallback to mandate spans when no speeches are linked yet (typical while
  // upstream backfill is still mid-corpus).
  const years = mandates
    .flatMap((m) => [m.from?.slice(0, 4), m.to?.slice(0, 4)])
    .flatMap((y) => (y ? [y] : []));
  if (years.length === 0) return null;
  const min = years.reduce((a, b) => (a < b ? a : b));
  const max = years.reduce((a, b) => (a > b ? a : b));
  return min === max ? min : `${min}–${max}`;
}

function pickCurrentMandate(mandates: Mandate[]): Mandate | null {
  if (mandates.length === 0) return null;
  // Prefer the open-ended mandate (no `to` date); otherwise the latest by `to`.
  const open = mandates.find((m) => !m.to);
  if (open) return open;
  return [...mandates].sort((a, b) => (a.to && b.to ? b.to.localeCompare(a.to) : 0))[0];
}

function PersonMeta({ person, stats }: { person: MoPerson; stats: PersonStats }) {
  const items: Array<{
    label: string;
    value: string | null;
    mono?: boolean;
    href?: string;
  }> = [
    {
      label: "Discursuri",
      value: stats.speech_count > 0 ? formatCount(stats.speech_count) : null,
      mono: true,
    },
    { label: "Primul discurs", value: formatDate(stats.first_speech_date), mono: true },
    { label: "Ultimul discurs", value: formatDate(stats.last_speech_date), mono: true },
    {
      label: "Wikidata",
      value: person.wikidata_qid,
      mono: true,
      href: person.wikidata_qid
        ? `https://www.wikidata.org/wiki/${person.wikidata_qid}`
        : undefined,
    },
  ].filter((i) => i.value);
  if (items.length === 0) return null;
  return (
    <dl className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="label-mono text-ink-45">{item.label}</dt>
          <dd
            className={
              item.mono ? "font-mono-meta mt-1 text-sm text-ink-16" : "mt-1 text-sm text-ink-16"
            }
            data-tabular-nums={item.mono ? "" : undefined}
          >
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-paper-91 underline-offset-4 hover:decoration-ink-30"
              >
                {item.value}
              </a>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MandateList({ mandates }: { mandates: Mandate[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {mandates.map((m, i) => (
        <li key={`${m.role}-${m.from ?? ""}-${m.to ?? ""}-${i}`} className="px-1 py-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-mono text-base font-semibold leading-tight text-ink-16">{m.role}</p>
            <p className="label-mono text-ink-45">
              {[m.chamber, m.party, m.legislature ? `legislatura ${m.legislature}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <p className="font-mono-meta mt-1 text-xs text-ink-45" data-tabular-nums="">
            {[formatDate(m.from), formatDate(m.to) ?? (m.from ? "în curs" : null)]
              .filter(Boolean)
              .join(" – ")}
          </p>
        </li>
      ))}
    </ol>
  );
}

function SpeechesList({ speeches }: { speeches: MoSpeech[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {speeches.map((speech) => {
        const parsed = parseDocumentId(speech.document_id);
        const docHref = parsed
          ? `/mo/${parsed.year}/${parsed.part}/${parsed.issue}#discurs-${speech.position_in_document ?? speech.position_in_agenda}`
          : null;
        // Canonical speech citation URL — see CLAUDE.md "Routes" entry for
        // /discurs/[slug]. Falls back to the in-doc anchor while transitional
        // records lack `slug` / `url_path`.
        const discursHref = speech.url_path || (speech.slug ? `/discurs/${speech.slug}` : null);
        const rowHref = discursHref ?? docHref ?? "/";
        const sessionDate = formatDate(speech.session_date);
        const excerpt = speechExcerpt(speech.text);
        const meta = speechMeta(speech);
        const wordCount = speechWordCount(speech.text);
        return (
          <li key={speech.record_id}>
            <Link
              href={rowHref}
              className="group/row block px-1 py-5 transition-colors hover:bg-paper-96"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="label-mono text-ink-45">
                  {[speech.chamber, sessionDate].filter(Boolean).join(" · ")}
                </p>
                <SpeechLengthMeter wordCount={wordCount} />
              </div>
              {excerpt ? (
                <p className="mt-2 text-base leading-relaxed text-ink-16">{excerpt}</p>
              ) : speech.agenda_title ? (
                <p className="mt-1 text-base leading-snug text-ink-16 group-hover/row:underline underline-offset-4">
                  {speech.agenda_title}
                </p>
              ) : null}
              {meta ? <p className="mt-2 label-mono text-ink-45">{meta}</p> : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

interface EmptySpeechesProps {
  selectedDate: string | null;
  selectedYear: number | null;
}

function EmptySpeeches({ selectedDate, selectedYear }: EmptySpeechesProps) {
  const message = selectedDate
    ? `Nu există discursuri înregistrate la ${formatDate(selectedDate) ?? selectedDate}.`
    : selectedYear
      ? `Nu există discursuri înregistrate în ${selectedYear}.`
      : "Nu există discursuri legate de această persoană în arhivă. Legarea numelor din stenograme la registrul politicienilor este în desfășurare; intrările vor apărea pe măsură ce reindexarea progresează.";
  return (
    <div className="border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm leading-relaxed text-ink-30">{message}</p>
    </div>
  );
}

function parseDocumentId(id: string): { year: string; part: string; issue: string } | null {
  const m = id.match(/^mo:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { year: m[1], part: m[2], issue: m[3] };
}

function PersonJsonLd({ person }: { person: MoPerson }) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/politicieni/${person.slug}`;
  const sameAs = person.wikidata_qid
    ? [`https://www.wikidata.org/wiki/${person.wikidata_qid}`]
    : undefined;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${url}#person`,
    name: person.canonical_name,
    url,
    inLanguage: "ro",
  };
  if (person.aliases.length > 0) jsonLd.alternateName = person.aliases;
  if (person.birth_date) jsonLd.birthDate = person.birth_date;
  if (sameAs) jsonLd.sameAs = sameAs;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
