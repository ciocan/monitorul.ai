import { cn } from "@/lib/utils";

import type { DocumentAgendaSummary } from "@/lib/document-discourse";

// Inline indicator rendered inside a Cuprins agenda row when the agenda's
// speeches generated at least one discourse marker. Compact label + count;
// shows the strongest score side as a tooltip.

export interface CuprinsMarkerIndicatorProps {
  summary: DocumentAgendaSummary;
  className?: string;
}

export function CuprinsMarkerIndicator({ summary, className }: CuprinsMarkerIndicatorProps) {
  const hge1 = summary.hCounts[1] + summary.hCounts[2];
  const vge1 = summary.vCounts[1] + summary.vCounts[2];
  const total = hge1 + vge1;
  if (total === 0 && summary.codedCount === 0) return null;
  const isHigh = summary.hCounts[2] > 0 || summary.vCounts[2] > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 font-mono-meta text-[11px]",
        "border",
        isHigh
          ? "border-alert-civic/40 text-alert-civic"
          : total > 0
            ? "border-paper-91 text-ink-30"
            : "border-paper-91 text-ink-45",
        className,
      )}
      data-tabular-nums=""
      title={tooltip(summary)}
    >
      <span>
        {summary.codedCount} {summary.codedCount === 1 ? "marker" : "marcheri"}
      </span>
      {summary.hCounts[2] > 0 ? <span aria-label="cluster H=2">·H2</span> : null}
      {summary.vCounts[2] > 0 ? <span aria-label="cluster V=2">·V2</span> : null}
    </span>
  );
}

function tooltip(s: DocumentAgendaSummary): string {
  const h = `Hawkins: 0=${s.hCounts[0]} 1=${s.hCounts[1]} 2=${s.hCounts[2]}`;
  const v = `V-Party: 0=${s.vCounts[0]} 1=${s.vCounts[1]} 2=${s.vCounts[2]}`;
  return `${s.codedCount} discursuri analizate · ${h} · ${v}`;
}
