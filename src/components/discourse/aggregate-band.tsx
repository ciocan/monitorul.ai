import { cn } from "@/lib/utils";

import type { DiscourseTrajectoryMonth } from "@/lib/types";

// Compact stacked-bar band rendering H=0 / H=1 / H=2 (or V variant) per bucket
// — one cell per month within a selected year, OR one cell per career year
// when no year is selected. Drawn as inline divs so the tokens flow through
// Tailwind classes — no chart library, no theme overrides, ~150 LOC.

const MONTH_LABELS_RO = ["I", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"];

export interface AggregateBandProps {
  monthly: DiscourseTrajectoryMonth[];
  granularity: "month" | "year";
  // When granularity is "month", the year of the selected drilldown.
  // When "year", the inclusive [first, last] career window the chart densifies
  // across. `null` falls back to the data's own min/max keys.
  year: number | null;
  yearRange?: { first: number | null; last: number | null };
  axis: "hawkins" | "vparty" | "dqi";
  className?: string;
}

const EMPTY_BUCKET = (key: string): DiscourseTrajectoryMonth => ({
  month: key,
  hawkins: { 0: 0, 1: 0, 2: 0 },
  vparty: { 0: 0, 1: 0, 2: 0 },
  dqi: { 0: 0, 1: 0, 2: 0, 3: 0 },
  codedTotal: 0,
});

export function AggregateBand({
  monthly,
  granularity,
  year,
  yearRange,
  axis,
  className,
}: AggregateBandProps) {
  const buckets =
    granularity === "month"
      ? buildMonthBuckets(monthly, year ?? new Date().getUTCFullYear())
      : buildYearBuckets(monthly, yearRange);

  const labels =
    granularity === "month"
      ? MONTH_LABELS_RO
      : buckets.map((b) => String(Number.parseInt(b.month, 10) % 100).padStart(2, "0"));

  const maxCoded = Math.max(1, ...buckets.map((b) => b.codedTotal));
  const barAreaH = 60;
  const labelH = 18;

  return (
    <div
      className={cn("border border-paper-91 bg-paper-99 px-3 pt-3 pb-2", className)}
      role="img"
      aria-label={axisDescription(axis, granularity, year)}
    >
      <div className="flex items-end gap-1">
        {buckets.map((m, i) => (
          <div
            key={m.month}
            className="flex min-w-0 flex-1 flex-col items-center"
            title={tooltipText(axis, m)}
          >
            {axis === "dqi" ? (
              <DqiStack month={m} maxCoded={maxCoded} barAreaH={barAreaH} />
            ) : (
              <HvStack month={m} axis={axis} maxCoded={maxCoded} barAreaH={barAreaH} />
            )}
            <span
              className={cn("font-mono-meta mt-1 text-[10px] text-ink-45 select-none")}
              style={{ height: labelH }}
            >
              {labels[i]}
            </span>
          </div>
        ))}
      </div>
      <Legend axis={axis} />
      <p className="font-mono-meta mt-1 text-[10px] text-ink-45" data-tabular-nums="">
        {granularity === "month"
          ? `${year} · max ${maxCoded} discursuri/lună`
          : `întreaga carieră · max ${maxCoded} discursuri/an`}
      </p>
    </div>
  );
}

function buildMonthBuckets(
  monthly: DiscourseTrajectoryMonth[],
  year: number,
): DiscourseTrajectoryMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return monthly.find((m) => m.month === key) ?? EMPTY_BUCKET(key);
  });
}

function buildYearBuckets(
  monthly: DiscourseTrajectoryMonth[],
  yearRange: AggregateBandProps["yearRange"],
): DiscourseTrajectoryMonth[] {
  const dataYears = monthly
    .map((m) => Number.parseInt(m.month, 10))
    .filter((n) => Number.isFinite(n));
  const first = yearRange?.first ?? (dataYears.length > 0 ? Math.min(...dataYears) : null);
  const last = yearRange?.last ?? (dataYears.length > 0 ? Math.max(...dataYears) : null);
  if (first === null || last === null) return monthly;
  const result: DiscourseTrajectoryMonth[] = [];
  for (let y = first; y <= last; y += 1) {
    const key = String(y);
    result.push(monthly.find((m) => m.month === key) ?? EMPTY_BUCKET(key));
  }
  return result;
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

function axisDescription(
  axis: "hawkins" | "vparty" | "dqi",
  granularity: "month" | "year",
  year: number | null,
): string {
  const name = axis === "hawkins" ? "Populism" : axis === "vparty" ? "Anti-pluralism" : "DQI";
  if (granularity === "year") {
    return `${name}: distribuția anuală a discursurilor analizate de-a lungul carierei`;
  }
  return `${name}: distribuția lunară a discursurilor analizate în ${year ?? "anul selectat"}`;
}

function tooltipText(axis: "hawkins" | "vparty" | "dqi", m: DiscourseTrajectoryMonth): string {
  if (axis === "dqi") {
    const c = m.dqi;
    return `${m.month}: L0:${c[0]} L1:${c[1]} L2:${c[2]} L3:${c[3]} (total ${m.codedTotal})`;
  }
  const c = m[axis];
  return `${m.month}: 0:${c[0]} 1:${c[1]} 2:${c[2]} (total ${m.codedTotal})`;
}
