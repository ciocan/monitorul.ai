import type { Metadata } from "next";
import Link from "next/link";

import { RegisterViewedTracker, YearSelectorTracker } from "@/components/analytics/page-trackers";
import { Dateline } from "@/components/dateline";
import { YearSparkbar } from "@/components/year-sparkbar";
import { env } from "@/env";
import {
  documentTypeLabel,
  formatCount,
  formatDate,
  pluralRo,
  sessionTypeLabel,
} from "@/lib/format";
import { sessionsIndex } from "@/lib/search";
import type { MoDocument } from "@/lib/types";

// The sessions register: every issue of Monitorul Oficial Partea II indexed by
// session date. Citation-grade landing for the chronological browse path the
// site header promises ("Sesiuni"). ISR 1h, JSON-LD CollectionPage so the page
// is harvestable as a public registry node.
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ year?: string | string[] }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

// Same shape as the politicieni page: `?year=` is non-canonical, year out of
// the parliamentary archive range silently falls back to the default. Keeps
// hand-crafted `?year=2099` URLs from rendering an empty register.
function parseYearParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1990 || n > 2100) return undefined;
  return n;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const year = parseYearParam(firstParam(sp.year));
  const title = year ? `Sesiuni · ${year}` : "Sesiuni";
  const description = year
    ? `Numerele Monitorului Oficial al României, Partea a II-a, publicate în ${year}.`
    : "Toate numerele Monitorului Oficial al României, Partea a II-a, indexate după data ședinței.";
  return {
    title,
    description,
    // `?year=` is intentionally non-canonical — the canonical entry-point is
    // /mo, mirroring how /politicieni/<slug> handles its own year filter.
    alternates: { canonical: "/mo" },
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "website", locale: "ro_RO", url: "/mo" },
  };
}

export default async function SessionsIndexPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requestedYear = parseYearParam(firstParam(sp.year));
  const { yearlyCounts, sessions, selectedYear, archiveSessionTotal } = await sessionsIndex({
    year: requestedYear,
  });
  const yearCount = selectedYear
    ? (yearlyCounts.find((c) => c.year === selectedYear)?.count ?? sessions.length)
    : 0;

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <SessionsJsonLd selectedYear={selectedYear} archiveSessionTotal={archiveSessionTotal} />
      <RegisterViewedTracker
        register="mo"
        year={selectedYear ?? null}
        has_year_filter={requestedYear !== undefined}
      />
      {selectedYear ? <YearSelectorTracker page="mo" year={selectedYear} /> : null}

      <Dateline
        parts={[
          "Monitorul Oficial",
          "Partea a II-a",
          "Sesiuni",
          selectedYear ? String(selectedYear) : null,
        ]}
      />

      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-tight text-ink-16 sm:text-5xl">Sesiuni</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-30">
          Numerele Monitorului Oficial al României, <em>Partea a II-a</em>, indexate după data
          ședinței. Selectați un an pentru a vedea documentele publicate în acea perioadă.
        </p>
        <ArchiveSummary
          archiveSessionTotal={archiveSessionTotal}
          selectedYear={selectedYear}
          yearCount={yearCount}
        />
      </header>

      {yearlyCounts.length > 0 && selectedYear ? (
        <section className="mt-10" aria-labelledby="ani">
          <h2 id="ani" className="label-mono mb-4 text-ink-30">
            Ani
          </h2>
          <YearSparkbar
            yearlyCounts={yearlyCounts}
            selectedYear={selectedYear}
            hrefForYear={(year) => `/mo?year=${year}`}
            navAriaLabel="Selectează anul sesiunilor"
            countNoun={{ one: "sesiune", few: "sesiuni", many: "de sesiuni" }}
            stretch
          />
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="sesiuni-an">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="sesiuni-an" className="label-mono text-ink-30">
            {selectedYear ? `Sesiuni din ${selectedYear}` : "Sesiuni"}
          </h2>
          {sessions.length > 0 ? (
            <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
              {pluralRo(sessions.length, "sesiune", "sesiuni", "de sesiuni")}
            </span>
          ) : null}
        </div>
        {sessions.length === 0 ? (
          <EmptySessions selectedYear={selectedYear} />
        ) : (
          <SessionsList sessions={sessions} />
        )}
      </section>
    </div>
  );
}

function ArchiveSummary({
  archiveSessionTotal,
  selectedYear,
  yearCount,
}: {
  archiveSessionTotal: number;
  selectedYear: number | null;
  yearCount: number;
}) {
  if (archiveSessionTotal === 0) return null;
  const archive = `${formatCount(archiveSessionTotal)} ${pluralRo(
    archiveSessionTotal,
    "sesiune",
    "sesiuni",
    "de sesiuni",
  ).replace(/^\d+\s/, "")} în arhivă`;
  const yearLabel =
    selectedYear && yearCount > 0 ? `${formatCount(yearCount)} în ${selectedYear}` : null;
  return (
    <p className="font-mono-meta mt-6 text-sm text-ink-45" data-tabular-nums="">
      {archive}
      {yearLabel ? (
        <>
          <span className="px-2 text-ink-45">·</span>
          {yearLabel}
        </>
      ) : null}
    </p>
  );
}

function SessionsList({ sessions }: { sessions: MoDocument[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {sessions.map((doc) => (
        <SessionRow key={doc.record_id} doc={doc} />
      ))}
    </ol>
  );
}

function SessionRow({ doc }: { doc: MoDocument }) {
  const sessionDate = formatDate(doc.session_date);
  const meta = [
    doc.chamber,
    sessionTypeLabel(doc.session_type),
    doc.legislature ? `legislatura ${doc.legislature}` : null,
    doc.speech_count > 0
      ? pluralRo(doc.speech_count, "discurs", "discursuri", "de discursuri")
      : null,
    doc.vote_count > 0 ? pluralRo(doc.vote_count, "vot", "voturi", "de voturi") : null,
  ].filter((m): m is string => Boolean(m));
  return (
    <li>
      <Link
        href={`/mo/${doc.year}/${doc.part}/${doc.issue}`}
        className="group/row block px-1 py-5 transition-colors hover:bg-paper-96"
      >
        <div className="flex items-baseline gap-4">
          <time
            className="font-mono-meta w-28 shrink-0 text-sm text-ink-30 sm:w-40"
            data-tabular-nums=""
            dateTime={doc.session_date ?? undefined}
          >
            {sessionDate ?? "—"}
          </time>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug text-ink-16 group-hover/row:underline underline-offset-4">
              {documentTypeLabel(doc.document_type)}
            </p>
            {meta.length > 0 ? (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 label-mono text-ink-45">
                {meta.map((part, i) => (
                  <span key={`${i}-${part}`}>{part}</span>
                ))}
              </p>
            ) : null}
          </div>
          <span
            className="font-mono-meta hidden shrink-0 text-sm text-ink-45 sm:inline"
            data-tabular-nums=""
          >
            Nr. {doc.issue}
          </span>
        </div>
      </Link>
    </li>
  );
}

function EmptySessions({ selectedYear }: { selectedYear: number | null }) {
  const message = selectedYear
    ? `Nu există sesiuni indexate pentru anul ${selectedYear}.`
    : "Arhiva nu conține deocamdată nicio sesiune. Indexarea este în curs.";
  return (
    <div className="border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm leading-relaxed text-ink-30">{message}</p>
    </div>
  );
}

function SessionsJsonLd({
  selectedYear,
  archiveSessionTotal,
}: {
  selectedYear: number | null;
  archiveSessionTotal: number;
}) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/mo`;
  const name = selectedYear ? `Sesiuni · ${selectedYear}` : "Sesiuni";
  const description = selectedYear
    ? `Numerele Monitorului Oficial al României, Partea a II-a, publicate în ${selectedYear}.`
    : "Numerele Monitorului Oficial al României, Partea a II-a, indexate după data ședinței.";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name,
    description,
    url,
    inLanguage: "ro",
    isPartOf: {
      "@type": "Periodical",
      name: "Monitorul Oficial al României, Partea a II-a",
    },
  };
  if (archiveSessionTotal > 0) {
    jsonLd.numberOfItems = archiveSessionTotal;
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
