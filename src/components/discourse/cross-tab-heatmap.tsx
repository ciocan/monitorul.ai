import { cn } from "@/lib/utils";

import type { DiscourseHvCrosstab } from "@/lib/types";

// 3×3 grid for the H × V cross-tab. Cells colored by intensity (warmer = more
// speeches). The illiberal cluster (H=2 + V≥1) is bordered with alert-civic
// to emphasise the headline finding.

const H_LABELS = ["H=0", "H=1", "H=2"] as const;
const V_LABELS = ["V=0", "V=1", "V=2"] as const;

export interface CrossTabHeatmapProps {
  data: DiscourseHvCrosstab;
  className?: string;
}

export function CrossTabHeatmap({ data, className }: CrossTabHeatmapProps) {
  const lookup = new Map<string, number>();
  for (const c of data.cells) lookup.set(`${c.h}-${c.v}`, c.count);
  const max = Math.max(1, ...data.cells.map((c) => c.count));
  return (
    <div
      className={cn("border border-paper-91 bg-paper-99 px-3 py-3", className)}
      role="table"
      aria-label="Distribuția H × V"
    >
      <div className="grid grid-cols-[64px_repeat(3,_1fr)] gap-px">
        <div />
        {V_LABELS.map((vl) => (
          <div key={vl} className="label-mono text-center text-ink-45">
            {vl}
          </div>
        ))}
        {H_LABELS.map((hl, hIdx) => (
          <Row key={hl} hLabel={hl} hIdx={hIdx} lookup={lookup} max={max} />
        ))}
      </div>
      <p className="font-mono-meta mt-3 text-[11px] text-ink-45">
        Cluster iliberal (H=2 + V ≥ 1):{" "}
        <span className="text-alert-civic">
          {data.illiberalCount.toLocaleString("ro-RO")} discursuri
        </span>{" "}
        din {data.total.toLocaleString("ro-RO")} cu codări H × V valide ·{" "}
        {data.total > 0 ? `${Math.round((data.illiberalCount / data.total) * 100)}%` : "—"}
      </p>
    </div>
  );
}

function Row({
  hLabel,
  hIdx,
  lookup,
  max,
}: {
  hLabel: string;
  hIdx: 0 | 1 | 2 | number;
  lookup: Map<string, number>;
  max: number;
}) {
  return (
    <>
      <div className="label-mono pr-2 text-right text-ink-45">{hLabel}</div>
      {[0, 1, 2].map((vIdx) => {
        const count = lookup.get(`${hIdx}-${vIdx}`) ?? 0;
        const intensity = count === 0 ? 0 : 0.18 + 0.78 * (count / max);
        const isCluster = hIdx === 2 && vIdx >= 1;
        const tint = isCluster ? "bg-alert-civic" : "bg-azure-3";
        return (
          <div
            key={`${hIdx}-${vIdx}`}
            className={cn(
              "relative flex h-16 items-center justify-center text-sm tabular-nums",
              isCluster ? "border border-alert-civic/70" : "border border-paper-91/0",
              count === 0 ? "text-ink-45" : "text-ink-30",
            )}
            style={{ backgroundColor: count === 0 ? "transparent" : undefined }}
          >
            <span
              aria-hidden
              className={cn("absolute inset-0", tint)}
              style={{ opacity: intensity }}
            />
            <span className="relative font-mono-meta" data-tabular-nums="">
              {count.toLocaleString("ro-RO")}
            </span>
          </div>
        );
      })}
    </>
  );
}
