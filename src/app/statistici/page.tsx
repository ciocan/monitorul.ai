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

function parseYear(raw: string | undefined): number {
  if (!raw) return new Date().getUTCFullYear();
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 2019 || n > 2100) return new Date().getUTCFullYear();
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
  const filters = {
    year,
    chamber,
    voiceMode: discourseParams.voiceMode,
    confidenceMin: discourseParams.confidenceMin,
  };

  const [timeSeries, crosstab, hPolitics, vPolitics, dqiPolitics, treemap] = await Promise.all([
    discourseTimeSeries(filters),
    discourseHvCrosstab(filters),
    topPoliticiansByDiscourseRate({ ...filters, axis: "hawkins", size: 10 }),
    topPoliticiansByDiscourseRate({ ...filters, axis: "vparty", size: 10 }),
    topPoliticiansByDiscourseRate({ ...filters, axis: "dqi", size: 10 }),
    discourseMarkerTreemap(filters),
  ]);

  // Build a stable URLSearchParams clone for the chip toggles. We only carry
  // the params the user explicitly set; defaults stay implicit.
  const chipSearchParams = new URLSearchParams();
  if (sp.year) chipSearchParams.set("year", String(year));
  if (chamber === "Camera Deputaților") chipSearchParams.set("chamber", "cd");
  if (chamber === "Senat") chipSearchParams.set("chamber", "senat");
  if (discourseParams.voiceMode === "all") chipSearchParams.set("voice", "all");
  if (discourseParams.confidenceMin === 0.7) chipSearchParams.set("conf", "07");

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <Dateline parts={["Discurs analizat", `${year}`, chamber ?? "Ambele camere"]} />
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
          1 · Distribuția lunară H ≥ 1 / V ≥ 1, {year}
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
          3 · Top politicieni · {year}
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MiniRankingTable data={hPolitics} />
          <MiniRankingTable data={vPolitics} />
          <MiniRankingTable data={dqiPolitics} />
        </div>
      </section>

      <section className="mt-10 space-y-3" aria-labelledby="treemap">
        <h2 id="treemap" className="label-mono text-ink-30">
          4 · Frecvența marcherilor
        </h2>
        <MarkerTreemap data={treemap} />
      </section>

      <MethodologyBlock className="mt-12" />

      <StatisticiJsonLd year={year} />
    </article>
  );
}

function FilterBar({
  year,
  chamber,
  chipSearchParams,
  discourseParams,
}: {
  year: number;
  chamber: Chamber | undefined;
  chipSearchParams: URLSearchParams;
  discourseParams: { voiceMode: "first-person" | "all"; confidenceMin: number | null };
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <YearChips selected={year} chamber={chamber} chipParams={chipSearchParams} />
      <ChamberChips selected={chamber} chipParams={chipSearchParams} year={year} />
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
  chamber: _chamber,
  chipParams,
}: {
  selected: number;
  chamber: Chamber | undefined;
  chipParams: URLSearchParams;
}) {
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  return (
    <span className="inline-flex flex-wrap items-baseline gap-px border border-paper-91 text-xs">
      {years.map((y) => {
        const sp = new URLSearchParams(chipParams);
        if (y === currentYear) sp.delete("year");
        else sp.set("year", String(y));
        const qs = sp.toString();
        const href = qs ? `${STATISTICI_PATH}?${qs}` : STATISTICI_PATH;
        const active = y === selected;
        return (
          <a
            key={y}
            href={href}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "bg-ink-16 px-2 py-1 text-paper-99"
                : "px-2 py-1 text-ink-30 hover:bg-paper-96 hover:text-ink-16"
            }
          >
            {y}
          </a>
        );
      })}
    </span>
  );
}

function ChamberChips({
  selected,
  chipParams,
  year,
}: {
  selected: Chamber | undefined;
  chipParams: URLSearchParams;
  year: number;
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
        if (year === new Date().getUTCFullYear()) sp.delete("year");
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

function StatisticiJsonLd({ year }: { year: number }) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}${STATISTICI_PATH}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#page`,
    name: `Statistici discurs analizat — ${year}`,
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
