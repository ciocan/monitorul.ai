import type { Metadata } from "next";

import { ConfidenceToggle } from "@/components/discourse/confidence-toggle";
import { CrossTabHeatmap } from "@/components/discourse/cross-tab-heatmap";
import { Dateline } from "@/components/dateline";
import { MarkerTreemap } from "@/components/discourse/marker-treemap";
import { MethodologyBlock } from "@/components/discourse/methodology-block";
import { MiniRankingTable } from "@/components/discourse/mini-ranking-table";
import { TimeSeriesLine } from "@/components/discourse/time-series-line";
import { VoiceToggle } from "@/components/discourse/voice-toggle";
import { env } from "@/env";
import { parseDiscourseParams } from "@/lib/discourse-params";
import {
  discourseHvCrosstab,
  discourseMarkerTreemap,
  discourseTimeSeries,
  topPoliticiansByDiscourseRate,
} from "@/lib/search";
import type { Chamber } from "@/lib/types";

// Stats page is `force-static` revalidated nightly — the four panels run
// system-wide aggs that don't change second-to-second; nightly cuts cost on
// repeat hits and matches the rest of the archive's caching cadence.
export const revalidate = 3600;

const STATISTICI_PATH = "/statistici";

interface PageProps {
  searchParams: Promise<{
    year?: string;
    chamber?: string;
    voice?: string;
    conf?: string;
  }>;
}

// Discourse coverage starts in 2020 (per /despre/discurs methodology). The chip
// row enumerates every coded year + an "all years" option; the user-visible
// default is "all" so the landing view shows the whole window at once.
const DISCOURSE_YEAR_START = 2020;

// Returns null when the user selected "all years" (no `?year=` param). A
// specific year clamps to [DISCOURSE_YEAR_START, currentYear]; anything outside
// that range falls back to all years rather than the previous current-year
// fallback.
function parseYear(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(n) || n < DISCOURSE_YEAR_START || n > currentYear) return null;
  return n;
}

function parseChamber(raw: string | undefined): Chamber | undefined {
  if (raw === "cd") return "Camera Deputaților";
  if (raw === "senat") return "Senat";
  return undefined;
}

export const metadata: Metadata = {
  title: "Statistici discurs analizat",
  description:
    "Distribuția lunară a populismului și anti-pluralismului, top politicieni, frecvența marcherilor.",
  alternates: { canonical: STATISTICI_PATH },
  robots: { index: true, follow: true },
};

export default async function StatisticiPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const year = parseYear(sp.year);
  const chamber = parseChamber(sp.chamber);
  const discourseParams = parseDiscourseParams(sp);
  // year=null → no session_date filter applied in the lib (aggregates across
  // every coded year). The chips emit `?year=YYYY` for specific years and the
  // bare path `/statistici` for "all years".
  const filters = {
    year: year ?? undefined,
    chamber,
    voiceMode: discourseParams.voiceMode,
    confidenceMin: discourseParams.confidenceMin,
  };

  const [timeSeries, crosstab, hPolitics, vPolitics, dqiPolitics, dqiCleanPolitics, treemap] =
    await Promise.all([
      discourseTimeSeries(filters),
      discourseHvCrosstab(filters),
      topPoliticiansByDiscourseRate({ ...filters, axis: "hawkins", size: 20 }),
      topPoliticiansByDiscourseRate({ ...filters, axis: "vparty", size: 20 }),
      topPoliticiansByDiscourseRate({ ...filters, axis: "dqi", size: 20 }),
      // Orthogonal view — DQI ≥ L2 AND Hawkins.score = 0 AND V-Party.score = 0.
      // Methodology Q2 forbids personality attribution; this panel keeps the
      // gate at the speech-act level, not at the speaker level.
      topPoliticiansByDiscourseRate({ ...filters, axis: "dqi-clean", size: 20 }),
      discourseMarkerTreemap(filters),
    ]);

  // Build a stable URLSearchParams clone for the chip toggles. We only carry
  // the params the user explicitly set; defaults stay implicit.
  const chipSearchParams = new URLSearchParams();
  if (year !== null) chipSearchParams.set("year", String(year));
  if (chamber === "Camera Deputaților") chipSearchParams.set("chamber", "cd");
  if (chamber === "Senat") chipSearchParams.set("chamber", "senat");
  if (discourseParams.voiceMode === "all") chipSearchParams.set("voice", "all");
  if (discourseParams.confidenceMin === 0.7) chipSearchParams.set("conf", "07");

  const yearLabel =
    year === null ? `${DISCOURSE_YEAR_START}–${new Date().getUTCFullYear()}` : `${year}`;

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <Dateline parts={["Discurs analizat", yearLabel, chamber ?? "Ambele camere"]} />
      <header className="mt-6 border-b border-border pb-6">
        <h1 className="font-display text-4xl leading-tight text-ink-16 sm:text-5xl">
          Statistici discurs analizat
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-30">
          Patru panouri peste arhiva discursurilor parlamentare codate sub Hawkins (populism),
          V-Party (anti-pluralism) și DQI (calitate deliberativă). Cifrele descriu speech-act-uri,
          nu trăsături personale.
        </p>
      </header>

      <FilterBar
        year={year}
        chamber={chamber}
        chipSearchParams={chipSearchParams}
        discourseParams={discourseParams}
      />

      <section className="mt-10 space-y-3" aria-labelledby="time-series">
        <h2 id="time-series" className="label-mono text-ink-30">
          1 · Distribuția lunară H ≥ 1 / V ≥ 1, {yearLabel}
        </h2>
        <TimeSeriesLine data={timeSeries} />
      </section>

      <section className="mt-10 space-y-3" aria-labelledby="crosstab">
        <h2 id="crosstab" className="label-mono text-ink-30">
          2 · Distribuția H × V — clusterul iliberal
        </h2>
        <CrossTabHeatmap data={crosstab} />
      </section>

      <section className="mt-10 space-y-3" aria-labelledby="rankings">
        <h2 id="rankings" className="label-mono text-ink-30">
          3 · Top politicieni · {yearLabel}
        </h2>
        <div className="space-y-4">
          <MiniRankingTable data={hPolitics} />
          <MiniRankingTable data={vPolitics} />
          <MiniRankingTable data={dqiPolitics} />
          <MiniRankingTable data={dqiCleanPolitics} />
        </div>
      </section>

      <section className="mt-10 space-y-3" aria-labelledby="treemap">
        <h2 id="treemap" className="label-mono text-ink-30">
          4 · Frecvența marcherilor
        </h2>
        <MarkerTreemap data={treemap} />
      </section>

      <MethodologyBlock className="mt-12" showRankingsNote />

      <StatisticiJsonLd label={yearLabel} />
    </article>
  );
}

function FilterBar({
  year,
  chamber,
  chipSearchParams,
  discourseParams,
}: {
  year: number | null;
  chamber: Chamber | undefined;
  chipSearchParams: URLSearchParams;
  discourseParams: { voiceMode: "first-person" | "all"; confidenceMin: number | null };
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <YearChips selected={year} chipParams={chipSearchParams} />
      <ChamberChips selected={chamber} chipParams={chipSearchParams} />
      <VoiceToggle
        basePath={STATISTICI_PATH}
        searchParams={chipSearchParams}
        voiceMode={discourseParams.voiceMode}
      />
      <ConfidenceToggle
        basePath={STATISTICI_PATH}
        searchParams={chipSearchParams}
        confidenceMin={discourseParams.confidenceMin}
      />
    </div>
  );
}

function YearChips({
  selected,
  chipParams,
}: {
  selected: number | null;
  chipParams: URLSearchParams;
}) {
  const currentYear = new Date().getUTCFullYear();
  // Newest first, ALL pinned to the front. Lower bound matches the documented
  // 2020 discourse coverage start.
  const years: Array<number | null> = [null];
  for (let y = currentYear; y >= DISCOURSE_YEAR_START; y--) years.push(y);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-px border border-paper-91 text-xs">
      {years.map((y) => {
        const sp = new URLSearchParams(chipParams);
        if (y === null) sp.delete("year");
        else sp.set("year", String(y));
        const qs = sp.toString();
        const href = qs ? `${STATISTICI_PATH}?${qs}` : STATISTICI_PATH;
        const active = y === selected;
        const label = y === null ? "Toți anii" : String(y);
        return (
          <a
            key={y ?? "all"}
            href={href}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "bg-ink-16 px-2 py-1 text-paper-99"
                : "px-2 py-1 text-ink-30 hover:bg-paper-96 hover:text-ink-16"
            }
          >
            {label}
          </a>
        );
      })}
    </span>
  );
}

function ChamberChips({
  selected,
  chipParams,
}: {
  selected: Chamber | undefined;
  chipParams: URLSearchParams;
}) {
  const options: Array<{ key: string; label: string; chamber: Chamber | null }> = [
    { key: "all", label: "Ambele", chamber: null },
    { key: "cd", label: "Camera", chamber: "Camera Deputaților" },
    { key: "senat", label: "Senatul", chamber: "Senat" },
  ];
  return (
    <span className="inline-flex flex-wrap items-baseline gap-px border border-paper-91 text-xs">
      {options.map((o) => {
        const sp = new URLSearchParams(chipParams);
        if (o.key === "all") sp.delete("chamber");
        else sp.set("chamber", o.key);
        const qs = sp.toString();
        const href = qs ? `${STATISTICI_PATH}?${qs}` : STATISTICI_PATH;
        const isActive =
          (o.chamber === null && selected === undefined) ||
          (o.chamber !== null && selected === o.chamber);
        return (
          <a
            key={o.key}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "bg-ink-16 px-2 py-1 text-paper-99"
                : "px-2 py-1 text-ink-30 hover:bg-paper-96 hover:text-ink-16"
            }
          >
            {o.label}
          </a>
        );
      })}
    </span>
  );
}

function StatisticiJsonLd({ label }: { label: string }) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}${STATISTICI_PATH}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#page`,
    name: `Statistici discurs analizat — ${label}`,
    inLanguage: "ro",
    url,
    isPartOf: {
      "@type": "WebSite",
      url: env.NEXT_PUBLIC_SITE_URL,
      name: "monitorul.ai",
    },
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
