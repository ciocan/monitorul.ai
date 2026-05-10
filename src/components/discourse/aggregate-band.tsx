import { cn } from "@/lib/utils";

import type { DiscourseTrajectoryMonth } from "@/lib/types";

// Compact stacked-bar band rendering H=0 / H=1 / H=2 (or V variant) per month
// for the selected year. Drawn as inline SVG so the tokens flow straight
// through Tailwind classes — no chart library, no theme overrides, ~100 LOC.
//
// Width: spans the whole flex column, so the chart's parent must establish
// the constraining width. Height is fixed at 80px (six bar slots, gives the
// month labels enough breathing room without dominating the page).

const MONTH_LABELS_RO = ["I", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"];

export interface AggregateBandProps {
  monthly: DiscourseTrajectoryMonth[];
  year: number;
  axis: "hawkins" | "vparty" | "dqi";
  className?: string;
}

export function AggregateBand({ monthly, year, axis, className }: AggregateBandProps) {
  // Pad/clip to exactly 12 months so the year always renders as a full year
  // strip even when the producer hasn't coded every month yet.
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, "0")}`;
    const found = monthly.find((m) => m.month === monthKey);
    return (
      found ?? {
        month: monthKey,
        hawkins: { 0: 0, 1: 0, 2: 0 },
        vparty: { 0: 0, 1: 0, 2: 0 },
        dqi: { 0: 0, 1: 0, 2: 0, 3: 0 },
        codedTotal: 0,
      }
    );
  });

  const maxCoded = Math.max(1, ...months.map((m) => m.codedTotal));
  const cellWidth = 32;
  const cellGap = 4;
  const barAreaH = 60;
  const labelH = 18;

  return (
    <div
      className={cn("border border-paper-91 bg-paper-99 px-3 pt-3 pb-2", className)}
      role="img"
      aria-label={axisDescription(axis, year)}
    >
      <div className="flex items-end gap-1">
        {months.map((m, i) => (
          <div
            key={m.month}
            className="flex flex-col items-center"
            style={{ width: cellWidth }}
            title={tooltipText(axis, m)}
          >
            {axis === "dqi" ? (
              <DqiStack month={m} maxCoded={maxCoded} barAreaH={barAreaH} />
            ) : (
              <HvStack month={m} axis={axis} maxCoded={maxCoded} barAreaH={barAreaH} />
            )}
            <span
              className={cn("font-mono-meta mt-1 text-[10px] text-ink-45", "select-none")}
              style={{ height: labelH }}
            >
              {MONTH_LABELS_RO[i]}
            </span>
          </div>
        ))}
      </div>
      <Legend axis={axis} />
      <p className="font-mono-meta mt-1 text-[10px] text-ink-45" data-tabular-nums="">
        {year} · max {maxCoded} discursuri/lună · {cellWidth}×{cellGap}px (px notation only, labels
        in monospace)
      </p>
    </div>
  );
}

function HvStack({
  month,
  axis,
  maxCoded,
  barAreaH,
}: {
  month: DiscourseTrajectoryMonth;
  axis: "hawkins" | "vparty";
  maxCoded: number;
  barAreaH: number;
}) {
  const counts = month[axis];
  const total = counts[0] + counts[1] + counts[2];
  const totalH = total === 0 ? 0 : Math.max(2, (total / maxCoded) * barAreaH);
  const safeTotal = total || 1;
  const h0 = (counts[0] / safeTotal) * totalH;
  const h1 = (counts[1] / safeTotal) * totalH;
  const h2 = (counts[2] / safeTotal) * totalH;
  return (
    <div
      className="flex w-full flex-col items-stretch overflow-hidden"
      style={{ height: barAreaH }}
    >
      <div style={{ flex: `0 0 ${barAreaH - totalH}px` }} />
      {h2 > 0 ? <div style={{ height: h2 }} className="bg-alert-civic/90" /> : null}
      {h1 > 0 ? <div style={{ height: h1 }} className="bg-alert-civic/40" /> : null}
      {h0 > 0 ? <div style={{ height: h0 }} className="bg-paper-91" /> : null}
    </div>
  );
}

function DqiStack({
  month,
  maxCoded,
  barAreaH,
}: {
  month: DiscourseTrajectoryMonth;
  maxCoded: number;
  barAreaH: number;
}) {
  const counts = month.dqi;
  const total = counts[0] + counts[1] + counts[2] + counts[3];
  const totalH = total === 0 ? 0 : Math.max(2, (total / maxCoded) * barAreaH);
  const safeTotal = total || 1;
  const h0 = (counts[0] / safeTotal) * totalH;
  const h1 = (counts[1] / safeTotal) * totalH;
  const h2 = (counts[2] / safeTotal) * totalH;
  const h3 = (counts[3] / safeTotal) * totalH;
  return (
    <div
      className="flex w-full flex-col items-stretch overflow-hidden"
      style={{ height: barAreaH }}
    >
      <div style={{ flex: `0 0 ${barAreaH - totalH}px` }} />
      {h3 > 0 ? <div style={{ height: h3 }} className="bg-azure-3" /> : null}
      {h2 > 0 ? <div style={{ height: h2 }} className="bg-azure-2" /> : null}
      {h1 > 0 ? <div style={{ height: h1 }} className="bg-azure-1" /> : null}
      {h0 > 0 ? <div style={{ height: h0 }} className="bg-paper-91" /> : null}
    </div>
  );
}

function Legend({ axis }: { axis: "hawkins" | "vparty" | "dqi" }) {
  if (axis === "dqi") {
    return (
      <div className="font-mono-meta mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-45">
        <LegendChip color="bg-azure-3" label="L3 sofisticată" />
        <LegendChip color="bg-azure-2" label="L2 calificată" />
        <LegendChip color="bg-azure-1" label="L1 inferioară" />
        <LegendChip color="bg-paper-91" label="L0 fără" />
      </div>
    );
  }
  return (
    <div className="font-mono-meta mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-45">
      <LegendChip color="bg-alert-civic/90" label="2 marcant" />
      <LegendChip color="bg-alert-civic/40" label="1 moderat" />
      <LegendChip color="bg-paper-91" label="0 fără" />
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block h-2 w-2", color)} />
      <span>{label}</span>
    </span>
  );
}

function axisDescription(axis: "hawkins" | "vparty" | "dqi", year: number): string {
  const name = axis === "hawkins" ? "Populism" : axis === "vparty" ? "Anti-pluralism" : "DQI";
  return `${name}: distribuția lunară a discursurilor analizate în ${year}`;
}

function tooltipText(axis: "hawkins" | "vparty" | "dqi", m: DiscourseTrajectoryMonth): string {
  if (axis === "dqi") {
    const c = m.dqi;
    return `${m.month}: L0:${c[0]} L1:${c[1]} L2:${c[2]} L3:${c[3]} (total ${m.codedTotal})`;
  }
  const c = m[axis];
  return `${m.month}: 0:${c[0]} 1:${c[1]} 2:${c[2]} (total ${m.codedTotal})`;
}
