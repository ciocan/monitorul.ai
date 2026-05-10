import { cn } from "@/lib/utils";

import type { DiscourseSystemTimeSeries } from "@/lib/types";

// Dual-line monthly chart for the system-wide H≥1 / V≥1 rate. Pure SVG
// path, two lines, year-long x-axis. Renders an empty state when no months
// carry data.

const VB_WIDTH = 1200;
const VB_HEIGHT = 200;
const PADDING_LEFT = 36;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;

export interface TimeSeriesLineProps {
  data: DiscourseSystemTimeSeries;
  className?: string;
}

export function TimeSeriesLine({ data, className }: TimeSeriesLineProps) {
  const months = data.monthly;
  const innerW = VB_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const innerH = VB_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  if (months.length === 0) {
    return (
      <div className={cn("border border-paper-91 bg-paper-99 px-3 py-12 text-center", className)}>
        <p className="text-sm text-ink-45">Nu există date pentru acest filtru.</p>
      </div>
    );
  }
  // Build a 12-slot rate array (0..1) for each line; missing months render
  // as gaps (path uses M between disconnected points).
  const rates = months.map((m) => {
    const t = m.total || 1;
    return {
      month: m.month,
      hRate: m.hge1 / t,
      vRate: m.vge1 / t,
      total: m.total,
    };
  });
  const maxRate = Math.max(0.05, ...rates.map((r) => Math.max(r.hRate, r.vRate)));
  const xFor = (i: number) =>
    PADDING_LEFT + (rates.length === 1 ? innerW / 2 : (i / (rates.length - 1)) * innerW);
  const yFor = (rate: number) => PADDING_TOP + (1 - rate / maxRate) * innerH;
  const buildPath = (key: "hRate" | "vRate") =>
    rates
      .map((r, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(r[key]).toFixed(1)}`)
      .join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= maxRate + 0.05);
  return (
    <div className={cn("border border-paper-91 bg-paper-99 px-3 py-3", className)}>
      <svg
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[180px] w-full"
        role="img"
        aria-label="Rata lunară H≥1 și V≥1"
      >
        {yTicks.map((t) => {
          const y = yFor(t);
          return (
            <g key={t}>
              <line
                x1={PADDING_LEFT}
                x2={VB_WIDTH - PADDING_RIGHT}
                y1={y}
                y2={y}
                className="stroke-paper-91"
                strokeDasharray="2 3"
              />
              <text
                x={PADDING_LEFT - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-ink-45 font-mono text-[10px]"
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          );
        })}
        <path d={buildPath("hRate")} className="stroke-alert-civic fill-none" strokeWidth={2} />
        <path d={buildPath("vRate")} className="stroke-azure-3 fill-none" strokeWidth={2} />
        {rates.map((r, i) => (
          <g key={`pt-${i}`}>
            <circle cx={xFor(i)} cy={yFor(r.hRate)} r={2.4} className="fill-alert-civic">
              <title>{`${r.month}: H≥1 ${(r.hRate * 100).toFixed(1)}% din ${r.total}`}</title>
            </circle>
            <circle cx={xFor(i)} cy={yFor(r.vRate)} r={2.4} className="fill-azure-3">
              <title>{`${r.month}: V≥1 ${(r.vRate * 100).toFixed(1)}% din ${r.total}`}</title>
            </circle>
          </g>
        ))}
        {rates.map((r, i) => {
          if (i % 2 !== 0) return null;
          return (
            <text
              key={`label-${i}`}
              x={xFor(i)}
              y={PADDING_TOP + innerH + 18}
              textAnchor="middle"
              className="fill-ink-45 font-mono text-[10px]"
            >
              {r.month.slice(2)}
            </text>
          );
        })}
      </svg>
      <div className="font-mono-meta mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-45">
        <span className="inline-flex items-center gap-1">
          <span className="bg-alert-civic inline-block h-px w-4" />
          H ≥ 1 (Hawkins)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="bg-azure-3 inline-block h-px w-4" />V ≥ 1 (V-Party)
        </span>
        <span>·</span>
        <span>{data.year === null ? "Toți anii" : data.year}</span>
      </div>
    </div>
  );
}
