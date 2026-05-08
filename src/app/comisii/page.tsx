import type { Metadata } from "next";
import Link from "next/link";

import { Dateline } from "@/components/dateline";
import { YearSparkbar } from "@/components/year-sparkbar";
import { env } from "@/env";
import { committeeKindLabel, formatCount, formatDate, pluralRo } from "@/lib/format";
import { committeesIndex } from "@/lib/search";
import type { CommitteeRankRow } from "@/lib/types";

// The committees register: top-N most active committees for the selected
// year (defaults to the most recent year with meetings). Mirrors `/politicieni`
// — same year sparkbar, same `?year=` query, same canonical handling. There
// is no upstream `mo-committees` index; the registry is derived live from
// `mo-committee-meetings`. ISR 1h, JSON-LD CollectionPage so the registry is
// harvestable.
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ year?: string | string[] }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseYearParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1990 || n > 2100) return undefined;
  return n;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const year = parseYearParam(firstParam(sp.year));
  const title = year ? `Comisii · ${year}` : "Comisii";
  const description = year
    ? `Cele mai active comisii parlamentare ale Camerei Deputaților, Senatului și ședințele comune în ${year}, după numărul de ședințe înregistrate în Monitorul Oficial.`
    : "Registrul comisiilor parlamentare ale Camerei Deputaților, Senatului și ședințele comune, indexate din Monitorul Oficial al României, Partea a II-a.";
  return {
    title,
    description,
    // `?year=` is non-canonical — same convention as /mo and /politicieni.
    alternates: { canonical: "/comisii" },
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "website", locale: "ro_RO", url: "/comisii" },
  };
}

export default async function CommitteesIndexPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requestedYear = parseYearParam(firstParam(sp.year));
  const {
    yearlyCounts,
    topCommittees,
    selectedYear,
    totalCommittees,
    committeesInScope,
    meetingsInScope,
  } = await committeesIndex({ year: requestedYear });

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <CommitteesJsonLd selectedYear={selectedYear} totalCommittees={totalCommittees} />

      <Dateline
        parts={[
          "Registrul comisiilor",
          selectedYear ? String(selectedYear) : null,
          totalCommittees > 0 ? `${formatCount(totalCommittees)} indexate` : null,
        ]}
      />

      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-tight text-ink-16 sm:text-5xl">Comisii</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-30">
          Comisiile parlamentare ale Camerei Deputaților, Senatului și ședințele comune, extrase din
          Monitorul Oficial, <em>Partea a II-a</em>. Lista îi ordonează după numărul de ședințe
          înregistrate în anul selectat.
        </p>
        <ScopeSummary
          selectedYear={selectedYear}
          committeesInScope={committeesInScope}
          meetingsInScope={meetingsInScope}
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
            hrefForYear={(year) => `/comisii?year=${year}`}
            navAriaLabel="Selectează anul ședințelor"
            countNoun={{ one: "ședință", few: "ședințe", many: "de ședințe" }}
          />
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="rank">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="rank" className="label-mono text-ink-30">
            {selectedYear
              ? `Cele mai active comisii în ${selectedYear}`
              : "Cele mai active comisii"}
          </h2>
          {topCommittees.length > 0 ? (
            <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
              top {topCommittees.length}
            </span>
          ) : null}
        </div>
        {topCommittees.length === 0 ? (
          <EmptyRank selectedYear={selectedYear} />
        ) : (
          <RankList rows={topCommittees} />
        )}
      </section>

      <RegistryFootnote totalCommittees={totalCommittees} committeesInScope={committeesInScope} />
    </div>
  );
}

function ScopeSummary({
  selectedYear,
  committeesInScope,
  meetingsInScope,
}: {
  selectedYear: number | null;
  committeesInScope: number;
  meetingsInScope: number;
}) {
  if (committeesInScope === 0 || meetingsInScope === 0) return null;
  const committeesLabel = `${formatCount(committeesInScope)} ${pluralRo(
    committeesInScope,
    "comisie activă",
    "comisii active",
    "de comisii active",
  ).replace(/^\d+\s/, "")}`;
  const meetingsLabel = `${formatCount(meetingsInScope)} ${pluralRo(
    meetingsInScope,
    "ședință",
    "ședințe",
    "de ședințe",
  ).replace(/^\d+\s/, "")}`;
  return (
    <p className="font-mono-meta mt-6 text-sm text-ink-45" data-tabular-nums="">
      {committeesLabel}
      <span className="px-2 text-ink-45">·</span>
      {meetingsLabel}
      {selectedYear ? (
        <>
          <span className="px-2 text-ink-45">·</span>
          {selectedYear}
        </>
      ) : null}
    </p>
  );
}

function RankList({ rows }: { rows: CommitteeRankRow[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {rows.map((row, i) => (
        <RankRow key={row.committeeId} rank={i + 1} row={row} />
      ))}
    </ol>
  );
}

function RankRow({ rank, row }: { rank: number; row: CommitteeRankRow }) {
  const lastMeeting = formatDate(row.lastMeetingDate);
  const meta = [
    committeeKindLabel(row.kind),
    row.jointWith && row.jointWith.length > 0 ? "comună" : null,
    lastMeeting ? `ultima ${lastMeeting}` : null,
  ].filter((m): m is string => Boolean(m));
  return (
    <li>
      <Link
        href={`/comisii/${encodeURIComponent(row.committeeId)}`}
        className="group/row block px-1 py-5 transition-colors hover:bg-paper-96"
      >
        <div className="flex items-baseline gap-4">
          <span
            className="font-mono-meta w-10 shrink-0 text-sm text-ink-45"
            data-tabular-nums=""
            aria-hidden="true"
          >
            {String(rank).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug text-ink-16 group-hover/row:underline underline-offset-4">
              {row.name}
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
            className="font-mono-meta shrink-0 text-sm text-ink-30"
            data-tabular-nums=""
            aria-label={`${formatCount(row.meetingCount)} ${
              row.meetingCount === 1 ? "ședință" : "ședințe"
            }`}
          >
            {formatCount(row.meetingCount)}
          </span>
        </div>
      </Link>
    </li>
  );
}

function EmptyRank({ selectedYear }: { selectedYear: number | null }) {
  const message = selectedYear
    ? `Nu există ședințe de comisie indexate pentru anul ${selectedYear}.`
    : "Registrul nu conține deocamdată nicio comisie. Indexarea este în curs.";
  return (
    <div className="border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm leading-relaxed text-ink-30">{message}</p>
    </div>
  );
}

function RegistryFootnote({
  totalCommittees,
  committeesInScope,
}: {
  totalCommittees: number;
  committeesInScope: number;
}) {
  if (totalCommittees === 0) return null;
  return (
    <aside className="mt-12 border-t border-border pt-6">
      <p className="max-w-prose text-sm leading-relaxed text-ink-45">
        Registrul conține{" "}
        <span className="font-mono-meta text-ink-30" data-tabular-nums="">
          {formatCount(totalCommittees)}
        </span>{" "}
        de comisii indexate; doar o parte au ședințe în anul selectat (
        <span className="font-mono-meta text-ink-30" data-tabular-nums="">
          {formatCount(committeesInScope)}
        </span>
        ). Comisiile fără activitate înregistrată în Monitorul Oficial nu apar în acest registru.
      </p>
    </aside>
  );
}

function CommitteesJsonLd({
  selectedYear,
  totalCommittees,
}: {
  selectedYear: number | null;
  totalCommittees: number;
}) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/comisii`;
  const name = selectedYear ? `Comisii · ${selectedYear}` : "Comisii";
  const description = selectedYear
    ? `Cele mai active comisii parlamentare în ${selectedYear}, după numărul de ședințe din Monitorul Oficial.`
    : "Registrul comisiilor parlamentare din Monitorul Oficial al României, Partea a II-a.";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name,
    description,
    url,
    inLanguage: "ro",
    about: { "@type": "Thing", name: "Comisiile Parlamentului României" },
  };
  if (totalCommittees > 0) {
    jsonLd.numberOfItems = totalCommittees;
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
