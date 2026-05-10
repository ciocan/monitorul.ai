import Link from "next/link";

import { cn } from "@/lib/utils";

import { FRAMEWORK_LABEL_LONG, hvScoreLabel, markerKindLabel } from "@/lib/discourse-copy";
import type { DiscourseUiParams } from "@/lib/discourse-params";
import type { DiscourseFramework, PersonDiscourseTrajectoryPayload } from "@/lib/types";

import { AggregateBand } from "./aggregate-band";
import { ConfidenceToggle } from "./confidence-toggle";
import { CoverageBand } from "./coverage-band";
import { FRAMEWORK_FG } from "./framework-badge";
import { FrameworkTabStrip } from "./framework-tab-strip";
import { MarkerChip } from "./marker-chip";
import { SpeechDotScatter } from "./speech-dot-scatter";
import { VoiceMixArea } from "./voice-mix-area";
import { VoiceToggle } from "./voice-toggle";

// Panel rendered on `/politicieni/[slug]` between the heatmap and the
// recent-speeches list. Holds the framework tab strip + the rate-framed
// stats + the chart proper. All four tabs share the same layout shell so
// readers don't lose orientation when they swap.

export interface PersonDiscoursePanelProps {
  trajectory: PersonDiscourseTrajectoryPayload;
  framework: DiscourseFramework;
  basePath: string;
  searchParams: URLSearchParams;
  params: DiscourseUiParams;
  className?: string;
}

export function PersonDiscoursePanel({
  trajectory,
  framework,
  basePath,
  searchParams,
  params,
  className,
}: PersonDiscoursePanelProps) {
  const { selectedYear, monthly, speechDots, coverage, topMarkerKinds, voiceMix } = trajectory;
  const codedThisYear = monthly.reduce((acc, m) => acc + m.codedTotal, 0);
  const yearStats = computeRateStats(monthly, framework);
  const speechDotsThisYear = speechDots.filter((d) =>
    d.sessionDate.startsWith(String(selectedYear)),
  );
  return (
    <section className={cn("space-y-6", className)} aria-labelledby="discurs-analiza">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="discurs-analiza" className="label-mono text-ink-30">
          Analiza discursului
        </h2>
        <div className="flex flex-wrap gap-2">
          <VoiceToggle
            basePath={basePath}
            searchParams={searchParams}
            voiceMode={params.voiceMode}
          />
          <ConfidenceToggle
            basePath={basePath}
            searchParams={searchParams}
            confidenceMin={params.confidenceMin}
          />
        </div>
      </header>

      <CoverageBand
        coverage={coverage}
        basePath={basePath}
        searchParams={searchParams}
        selectedYear={selectedYear}
      />

      <FrameworkTabStrip basePath={basePath} searchParams={searchParams} current={framework} />

      {framework === "voice" ? (
        <div className="space-y-3">
          <RateLine
            framework="voice"
            year={selectedYear}
            codedThisYear={codedThisYear}
            primary={null}
          />
          <VoiceMixArea voiceMix={voiceMix} year={selectedYear} />
          <p className="text-xs leading-relaxed text-ink-45">
            Distribuția vocii dominante per discurs analizat. Voce proprie = vorbitorul afirmă în
            nume propriu; restul claselor (citat, negat, apofază, etc.) marchează rhetorica
            indirectă pentru care contrast şi denegare sunt centrate de speech-act, nu de
            speaker-trait.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <RateLine
            framework={framework}
            year={selectedYear}
            codedThisYear={codedThisYear}
            primary={yearStats}
          />
          <AggregateBand
            monthly={monthly}
            year={selectedYear}
            axis={framework === "dqi" ? "dqi" : framework}
          />
          <SpeechDotScatter
            dots={speechDotsThisYear}
            year={selectedYear}
            axis={framework === "dqi" ? "dqi" : framework}
          />
          {topMarkerKinds.length > 0 && framework !== "dqi" ? (
            <div className="space-y-1">
              <p className="label-mono text-ink-30">Marcheri principali în {selectedYear}</p>
              <div className="flex flex-wrap gap-1">
                {topMarkerKinds
                  .filter((m) => m.framework === framework)
                  .map((m) => (
                    <MarkerChip
                      key={`${m.framework}-${m.kind}`}
                      framework={m.framework}
                      kind={m.kind}
                      count={m.count}
                      variant="kind-count"
                    />
                  ))}
                {topMarkerKinds.filter((m) => m.framework === framework).length === 0 ? (
                  <span className="text-xs text-ink-45">Niciun marker în acest an.</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <footer className="border-t border-paper-91 pt-3">
        <p className="font-mono-meta text-[11px] leading-relaxed text-ink-45">
          {trajectory.producerLabel ? <>Codat de {trajectory.producerLabel}. </> : null}
          Cifrele descriu speech-act-uri, nu trăsături personale.{" "}
          <Link
            href="/despre#discurs-analiza"
            className="underline decoration-paper-91 underline-offset-2 hover:text-ink-30 hover:decoration-ink-30"
          >
            Metodologia
          </Link>
          .
        </p>
      </footer>
    </section>
  );
}

interface RateStats {
  total: number;
  ge1: number;
  eq2: number;
  topMarker: { kind: string; count: number } | null;
}

function computeRateStats(
  monthly: PersonDiscourseTrajectoryPayload["monthly"],
  framework: DiscourseFramework,
): RateStats {
  const totals = { total: 0, ge1: 0, eq2: 0 };
  for (const m of monthly) {
    if (framework === "hawkins") {
      totals.total += m.hawkins[0] + m.hawkins[1] + m.hawkins[2];
      totals.ge1 += m.hawkins[1] + m.hawkins[2];
      totals.eq2 += m.hawkins[2];
    } else if (framework === "vparty") {
      totals.total += m.vparty[0] + m.vparty[1] + m.vparty[2];
      totals.ge1 += m.vparty[1] + m.vparty[2];
      totals.eq2 += m.vparty[2];
    } else if (framework === "dqi") {
      totals.total += m.dqi[0] + m.dqi[1] + m.dqi[2] + m.dqi[3];
      totals.ge1 += m.dqi[2] + m.dqi[3];
      totals.eq2 += m.dqi[3];
    }
  }
  return { ...totals, topMarker: null };
}

function RateLine({
  framework,
  year,
  codedThisYear,
  primary,
}: {
  framework: DiscourseFramework;
  year: number;
  codedThisYear: number;
  primary: RateStats | null;
}) {
  if (codedThisYear === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-45">
        Niciun discurs analizat în {year} sub filtrul curent.
      </p>
    );
  }
  if (framework === "voice") {
    return (
      <p className="text-sm leading-relaxed text-ink-30">
        <span className={cn("label-mono mr-2", FRAMEWORK_FG.voice)}>Voce</span>
        {codedThisYear} discursuri analizate în {year}, distribuite după voce dominantă.
      </p>
    );
  }
  if (!primary || primary.total === 0) return null;
  const ge1Pct = Math.round((primary.ge1 / primary.total) * 100);
  const eq2Pct = Math.round((primary.eq2 / primary.total) * 100);
  const label = framework === "hawkins" ? "≥1" : framework === "vparty" ? "≥1" : "≥L2";
  const label2 = framework === "hawkins" ? "=2" : framework === "vparty" ? "=2" : "=L3";
  return (
    <p className="text-sm leading-relaxed text-ink-30">
      <span className={cn("label-mono mr-2", FRAMEWORK_FG[framework])}>
        {FRAMEWORK_LABEL_LONG[framework]}
      </span>
      <strong className="text-ink-16">{ge1Pct}%</strong> din {primary.total} discursuri analizate în{" "}
      {year} au scor {label} ({primary.ge1} discursuri); <strong>{eq2Pct}%</strong> au scor {label2}{" "}
      ({primary.eq2}).
    </p>
  );
}

// (markerKindLabel re-exported for the panel's caller convenience — keeps
// the import surface minimal even though the panel itself uses MarkerChip.)
export { markerKindLabel, hvScoreLabel };
