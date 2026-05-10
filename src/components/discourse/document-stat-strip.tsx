import { cn } from "@/lib/utils";

import type { DiscourseUiParams } from "@/lib/discourse-params";
import type { DocumentDiscourseSummary } from "@/lib/document-discourse";

import { ConfidenceToggle } from "./confidence-toggle";
import { MarkerChip } from "./marker-chip";
import { VoiceToggle } from "./voice-toggle";

// Top-of-document stat strip rendered between the header and the Cuprins.
// Mono-uppercase register matches the existing `<Dateline>` and the rest of
// the document's chrome. Hidden entirely when the document has zero coded
// speeches (committee_synthesis without speeches, pre-coverage docs).

export interface DocumentStatStripProps {
  summary: DocumentDiscourseSummary;
  basePath: string;
  searchParams: URLSearchParams;
  params: DiscourseUiParams;
  className?: string;
}

export function DocumentStatStrip({
  summary,
  basePath,
  searchParams,
  params,
  className,
}: DocumentStatStripProps) {
  if (summary.codedCount === 0) return null;
  const ratio = summary.totalSubstantive
    ? Math.round((summary.codedCount / summary.totalSubstantive) * 100)
    : 0;
  const hge1 = summary.hCounts[1] + summary.hCounts[2];
  const vge1 = summary.vCounts[1] + summary.vCounts[2];
  const hge1Pct = summary.codedCount ? Math.round((hge1 / summary.codedCount) * 100) : 0;
  const vge1Pct = summary.codedCount ? Math.round((vge1 / summary.codedCount) * 100) : 0;
  return (
    <section
      className={cn("border border-paper-91 bg-paper-96/40 px-4 py-3", className)}
      aria-labelledby="discurs-strip"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="discurs-strip" className="label-mono text-ink-30">
          Analiza ședinței
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
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <Slot
          label="Discursuri analizate"
          value={`${summary.codedCount} din ${summary.totalSubstantive}`}
          extra={`${ratio}%`}
          accent="ink"
        />
        <Slot label="H ≥ 1" value={`${hge1} discursuri`} extra={`${hge1Pct}%`} accent="alert" />
        <Slot label="V ≥ 1" value={`${vge1} discursuri`} extra={`${vge1Pct}%`} accent="alert" />
        <div className="space-y-1">
          <dt className="label-mono text-ink-45">Marcheri principali</dt>
          {summary.topMarkerKinds.length === 0 ? (
            <dd className="text-sm text-ink-45">—</dd>
          ) : (
            <dd className="flex flex-wrap gap-1">
              {summary.topMarkerKinds.slice(0, 3).map((m) => (
                <MarkerChip
                  key={`${m.framework}-${m.kind}`}
                  framework={m.framework}
                  kind={m.kind}
                  count={m.count}
                  variant="kind-count"
                />
              ))}
            </dd>
          )}
        </div>
      </dl>
    </section>
  );
}

function Slot({
  label,
  value,
  extra,
  accent,
}: {
  label: string;
  value: string;
  extra?: string;
  accent: "ink" | "alert";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label-mono text-ink-45">{label}</dt>
      <dd className="flex items-baseline gap-2 text-sm text-ink-30">
        <span className={cn(accent === "alert" ? "text-alert-civic" : "text-ink-16")}>{value}</span>
        {extra ? (
          <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
            {extra}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
