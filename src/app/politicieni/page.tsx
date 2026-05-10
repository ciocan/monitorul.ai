import type { Metadata } from "next";
import Link from "next/link";

import { RegisterViewedTracker, YearSelectorTracker } from "@/components/analytics/page-trackers";
import { Dateline } from "@/components/dateline";
import { YearSparkbar } from "@/components/year-sparkbar";
import { env } from "@/env";
import { formatCount, pluralRo } from "@/lib/format";
import { politiciansIndex } from "@/lib/search";
import type { Mandate, MoPerson, PoliticianRankRow } from "@/lib/types";

// The politicians register: top-N most active politicians for the selected
// year (defaults to most recent active year). Mirrors `/mo` — same year
// sparkbar pattern, same `?year=` query, same `/mo`-style canonical handling.
// ISR 1h, JSON-LD CollectionPage so the registry is harvestable.
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ year?: string | string[]; mode?: string | string[] }>;
}

type RankMode = "substantive" | "all";

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

// `?mode=all` opts into ranking by every speech (procedural turn-taking
// included). Anything else — missing param, unknown value — falls back to the
// `substantive` default, which matches the public default for `is_substantive`
// applied across the rest of the layer.
function parseModeParam(raw: string | undefined): RankMode {
  return raw === "all" ? "all" : "substantive";
}

// Builds a `/politicieni?year=…&mode=…` URL while preserving the current mode.
// Mode is omitted from the URL when it equals the default so canonical-shaped
// URLs stay clean (`/politicieni?year=2025` rather than
// `/politicieni?year=2025&mode=substantive`).
function hrefForRank(opts: { year?: number; mode: RankMode }): string {
  const params = new URLSearchParams();
  if (opts.year !== undefined) params.set("year", String(opts.year));
  if (opts.mode === "all") params.set("mode", "all");
  const qs = params.toString();
  return qs ? `/politicieni?${qs}` : "/politicieni";
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const year = parseYearParam(firstParam(sp.year));
  const title = year ? `Politicieni · ${year}` : "Politicieni";
  const description = year
    ? `Cei mai activi politicieni din Parlamentul României în ${year}, după numărul de discursuri din Monitorul Oficial.`
    : "Registrul politicienilor din Parlamentul României, ordonat după activitatea recentă în Monitorul Oficial.";
  return {
    title,
    description,
    // `?year=` and `?mode=` are non-canonical — same convention as /mo and
    // /politicieni/[slug].
    alternates: { canonical: "/politicieni" },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ro_RO",
      url: "/politicieni",
    },
  };
}

export default async function PoliticiansIndexPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requestedYear = parseYearParam(firstParam(sp.year));
  const mode = parseModeParam(firstParam(sp.mode));
  const {
    yearlyCounts,
    topPersons,
    selectedYear,
    substantiveOnly,
    totalRegistryPersons,
    linkedPersonsInScope,
    speechesInScope,
  } = await politiciansIndex({
    year: requestedYear,
    substantiveOnly: mode === "substantive",
  });

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <PoliticiansJsonLd selectedYear={selectedYear} totalRegistryPersons={totalRegistryPersons} />
      <RegisterViewedTracker
        register="politicieni"
        year={selectedYear ?? null}
        has_year_filter={requestedYear !== undefined}
      />
      {selectedYear ? <YearSelectorTracker page="politicieni" year={selectedYear} /> : null}

      <Dateline
        parts={[
          "Registrul politicienilor",
          selectedYear ? String(selectedYear) : null,
          totalRegistryPersons > 0 ? `${formatCount(totalRegistryPersons)} indexați` : null,
        ]}
      />

      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-tight text-ink-16 sm:text-5xl">Politicieni</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-30">
          Registrul politicienilor din Parlamentul României, extras din stenogramele Monitorului
          Oficial, <em>Partea a II-a</em>. Lista îi ordonează după numărul de discursuri
          înregistrate în anul selectat — comutați mai jos între discursuri substanțiale și toate
          intervențiile (inclusiv cele procedurale).
        </p>
        <ScopeSummary
          selectedYear={selectedYear}
          linkedPersonsInScope={linkedPersonsInScope}
          speechesInScope={speechesInScope}
          substantiveOnly={substantiveOnly}
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
            hrefForYear={(year) => hrefForRank({ year, mode })}
            navAriaLabel="Selectează anul activității"
            countNoun={{ one: "discurs", few: "discursuri", many: "de discursuri" }}
            stretch
          />
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="rank">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="rank" className="label-mono text-ink-30">
            {selectedYear
              ? `Cei mai activi politicieni în ${selectedYear}`
              : "Cei mai activi politicieni"}
          </h2>
          {topPersons.length > 0 ? (
            <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
              top {topPersons.length}
            </span>
          ) : null}
        </div>
        <RankModeToggle mode={mode} year={selectedYear} />
        {topPersons.length === 0 ? (
          <EmptyRank selectedYear={selectedYear} />
        ) : (
          <RankList rows={topPersons} />
        )}
      </section>

      <RegistryFootnote
        totalRegistryPersons={totalRegistryPersons}
        linkedPersonsInScope={linkedPersonsInScope}
        selectedYear={selectedYear}
        substantiveOnly={substantiveOnly}
      />
    </div>
  );
}

function RankModeToggle({ mode, year }: { mode: RankMode; year: number | null }) {
  const yearForHref = year ?? undefined;
  return (
    <nav
      aria-label="Comută criteriul de ordonare"
      className="-mt-1 mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 label-mono text-ink-45"
    >
      <span className="text-ink-45">Ordonare:</span>
      <RankModeLink
        href={hrefForRank({ year: yearForHref, mode: "substantive" })}
        active={mode === "substantive"}
      >
        Discursuri substanțiale
      </RankModeLink>
      <span aria-hidden="true" className="text-ink-45">
        ·
      </span>
      <RankModeLink href={hrefForRank({ year: yearForHref, mode: "all" })} active={mode === "all"}>
        Toate intervențiile
      </RankModeLink>
    </nav>
  );
}

function RankModeLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  if (active) {
    return (
      <span
        aria-current="true"
        className="text-ink-16 underline decoration-ink-30 underline-offset-4"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      className="text-ink-30 transition-colors hover:text-ink-16"
    >
      {children}
    </Link>
  );
}

function ScopeSummary({
  selectedYear,
  linkedPersonsInScope,
  speechesInScope,
  substantiveOnly,
}: {
  selectedYear: number | null;
  linkedPersonsInScope: number;
  speechesInScope: number;
  substantiveOnly: boolean;
}) {
  if (linkedPersonsInScope === 0 || speechesInScope === 0) return null;
  const personsLabel = `${formatCount(linkedPersonsInScope)} ${pluralRo(
    linkedPersonsInScope,
    "politician activ",
    "politicieni activi",
    "de politicieni activi",
  ).replace(/^\d+\s/, "")}`;
  const speechesNoun = substantiveOnly
    ? pluralRo(
        speechesInScope,
        "discurs substanțial",
        "discursuri substanțiale",
        "de discursuri substanțiale",
      )
    : pluralRo(speechesInScope, "intervenție", "intervenții", "de intervenții");
  const speechesLabel = `${formatCount(speechesInScope)} ${speechesNoun.replace(/^\d+\s/, "")}`;
  return (
    <p className="font-mono-meta mt-6 text-sm text-ink-45" data-tabular-nums="">
      {personsLabel}
      <span className="px-2 text-ink-45">·</span>
      {speechesLabel}
      {selectedYear ? (
        <>
          <span className="px-2 text-ink-45">·</span>
          {selectedYear}
        </>
      ) : null}
    </p>
  );
}

function RankList({ rows }: { rows: PoliticianRankRow[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {rows.map((row, i) => (
        <RankRow key={row.personId} rank={i + 1} row={row} />
      ))}
    </ol>
  );
}

function RankRow({ rank, row }: { rank: number; row: PoliticianRankRow }) {
  const displayName = row.person?.canonical_name ?? row.fallbackName;
  const meta = mandateMeta(row.person, row);
  return (
    <li>
      <Link
        href={`/politicieni/${row.personId}`}
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
              {displayName}
              {row.person?.homonym_disambiguation ? (
                <span className="ml-2 text-sm font-normal text-ink-45">
                  ({row.person.homonym_disambiguation})
                </span>
              ) : null}
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
            aria-label={`${formatCount(row.speechCount)} ${row.speechCount === 1 ? "discurs" : "discursuri"}`}
          >
            {formatCount(row.speechCount)}
          </span>
        </div>
      </Link>
    </li>
  );
}

// Builds the procedural label under each row's name. Pulls role / party /
// chamber from the most-recent mandate when available, otherwise falls back
// to the speech window from the rank bucket. Most of the 4.6k linked persons
// have empty mandates today (only ~217 person records carry role data) so the
// fallback is the common case.
function mandateMeta(person: MoPerson | null, row: PoliticianRankRow): string[] {
  const parts: string[] = [];
  const mandate = person ? pickCurrentMandate(person.mandates) : null;
  if (mandate?.role) parts.push(mandate.role.replace(/_/g, " "));
  if (mandate?.party) parts.push(mandate.party);
  if (mandate?.chamber) parts.push(mandate.chamber);
  const span = speechSpan(row.firstSpeechDate, row.lastSpeechDate);
  if (span) parts.push(span);
  return parts;
}

function pickCurrentMandate(mandates: Mandate[]): Mandate | null {
  if (mandates.length === 0) return null;
  const open = mandates.find((m) => !m.to);
  if (open) return open;
  return [...mandates].sort((a, b) => (a.to && b.to ? b.to.localeCompare(a.to) : 0))[0];
}

function speechSpan(from: string | null, to: string | null): string | null {
  const fromYear = from ? from.slice(0, 4) : null;
  const toYear = to ? to.slice(0, 4) : null;
  if (!fromYear && !toYear) return null;
  if (!fromYear || !toYear) return fromYear ?? toYear;
  return fromYear === toYear ? fromYear : `${fromYear}–${toYear}`;
}

function EmptyRank({ selectedYear }: { selectedYear: number | null }) {
  const message = selectedYear
    ? `Niciun politician nu are discursuri legate pentru anul ${selectedYear}. Folosiți căutarea pentru a găsi pe cineva după nume.`
    : "Registrul nu conține deocamdată niciun politician cu discursuri legate. Indexarea este în curs.";
  return (
    <div className="border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm leading-relaxed text-ink-30">{message}</p>
    </div>
  );
}

function RegistryFootnote({
  totalRegistryPersons,
  linkedPersonsInScope,
  selectedYear,
  substantiveOnly,
}: {
  totalRegistryPersons: number;
  linkedPersonsInScope: number;
  selectedYear: number | null;
  substantiveOnly: boolean;
}) {
  if (totalRegistryPersons === 0) return null;
  const speechKindLabel = substantiveOnly ? "discursuri substanțiale" : "intervenții";
  return (
    <aside className="mt-12 border-t border-border pt-6">
      <p className="max-w-prose text-sm leading-relaxed text-ink-45">
        Registrul conține{" "}
        <span className="font-mono-meta text-ink-30" data-tabular-nums="">
          {formatCount(totalRegistryPersons)}
        </span>{" "}
        de persoane indexate; doar o parte au {speechKindLabel} legate
        {selectedYear ? ` în ${selectedYear}` : ""} (
        <span className="font-mono-meta text-ink-30" data-tabular-nums="">
          {formatCount(linkedPersonsInScope)}
        </span>
        ). Pentru a căuta pe oricine altcineva, folosiți câmpul de căutare din antet.
      </p>
    </aside>
  );
}

function PoliticiansJsonLd({
  selectedYear,
  totalRegistryPersons,
}: {
  selectedYear: number | null;
  totalRegistryPersons: number;
}) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/politicieni`;
  const name = selectedYear ? `Politicieni · ${selectedYear}` : "Politicieni";
  const description = selectedYear
    ? `Cei mai activi politicieni din Parlamentul României în ${selectedYear}, după numărul de discursuri din Monitorul Oficial.`
    : "Registrul politicienilor din Parlamentul României, ordonat după activitatea recentă în Monitorul Oficial.";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name,
    description,
    url,
    inLanguage: "ro",
    about: { "@type": "Thing", name: "Politicienii Parlamentului României" },
  };
  if (totalRegistryPersons > 0) {
    jsonLd.numberOfItems = totalRegistryPersons;
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
