import Link from "next/link";

import { cn } from "@/lib/utils";

import type { DiscourseSpeechDot } from "@/lib/types";

// SVG dot scatter: x = session_date (within selected year), y = score level.
// One dot per coded speech; color = secondary axis; radius = marker_count.
// Click a dot → speech detail page (with discourse overlay from Phase 1).
//
// Pure SVG — pre-computed positions in the parent so this component stays
// stateless. Uses viewBox + responsive sizing so the scatter survives the
// page's max-w-(--breakpoint-xl) container without hardcoding pixel widths.

const VB_WIDTH = 1200;
const VB_HEIGHT = 220;
const PADDING_LEFT = 30;
const PADDING_RIGHT = 12;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 28;

const ROW_LABEL = {
  hawkins: ["fără", "moderat", "marcant"],
  vparty: ["fără", "moderat", "marcant"],
  dqi: ["L0", "L1", "L2", "L3"],
} as const;

export interface SpeechDotScatterProps {
  dots: DiscourseSpeechDot[];
  // When set: filter to that year, x-axis spans Jan→Dec.
  // When null: span the entire `[firstYear, lastYear]` career window.
  year: number | null;
  firstYear?: number | null;
  lastYear?: number | null;
  axis: "hawkins" | "vparty" | "dqi";
  className?: string;
}

export function SpeechDotScatter({
  dots,
  year,
  firstYear,
  lastYear,
  axis,
  className,
}: SpeechDotScatterProps) {
  const innerW = VB_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const innerH = VB_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const labels = ROW_LABEL[axis];
  const rowCount = labels.length;
  const rowSpacing = innerH / Math.max(rowCount - 1, 1);

  // X-axis range: when year is set, [year-01-01, year-12-31]; when null, the
  // full career window [firstYear-01-01, lastYear-12-31].
  const rangeFirstYear = year ?? firstYear ?? new Date().getUTCFullYear();
  const rangeLastYear = year ?? lastYear ?? rangeFirstYear;
  const xStart = Date.UTC(rangeFirstYear, 0, 1);
  const xEnd = Date.UTC(rangeLastYear, 11, 31);

  // Filter dots to the visible window.
  const visible = dots.filter((d) => {
    if (year !== null && !d.sessionDate.startsWith(String(year))) return false;
    if (axis === "hawkins") return d.hScore !== null;
    if (axis === "vparty") return d.vScore !== null;
    return d.dqiLevel !== null;
  });
  const ariaWindow = year !== null ? `în ${year}` : `în întreaga carieră`;
  return (
    <div
      className={cn("border border-paper-91 bg-paper-99 px-3 py-3", className)}
      role="img"
      aria-label={`${visible.length} discursuri analizate ${ariaWindow}, plotate pe scara ${axis}`}
    >
      <svg
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[180px] w-full"
      >
        {labels.map((label, i) => {
          const y = PADDING_TOP + (rowCount - 1 - i) * rowSpacing;
          return (
            <g key={label}>
              <line
                x1={PADDING_LEFT}
                x2={VB_WIDTH - PADDING_RIGHT}
                y1={y}
                y2={y}
                className="stroke-paper-91"
                strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-ink-45 font-mono text-[10px]"
              >
                {label}
              </text>
            </g>
          );
        })}
        {year !== null
          ? monthGuides(year, innerW, PADDING_LEFT, PADDING_TOP, innerH)
          : yearGuides(rangeFirstYear, rangeLastYear, innerW, PADDING_LEFT, PADDING_TOP, innerH)}
        {visible.map((dot) => {
          const t = parseDateUtc(dot.sessionDate);
          const ratioX = xEnd === xStart ? 0.5 : (t - xStart) / (xEnd - xStart);
          const cx = PADDING_LEFT + ratioX * innerW;
          const score =
            axis === "hawkins" ? dot.hScore : axis === "vparty" ? dot.vScore : dot.dqiLevel;
          const rowIdx = score ?? 0;
          const cy = PADDING_TOP + (rowCount - 1 - rowIdx) * rowSpacing;
          // Dot radius: 3 baseline + log(marker_count). Caps at 7.
          const baseCount =
            axis === "hawkins"
              ? dot.hawkinsMarkerCount
              : axis === "vparty"
                ? dot.vpartyMarkerCount
                : 1;
          const r = Math.min(7, 3 + Math.log2(Math.max(1, baseCount)) * 1.4);
          // Color: secondary score's intensity. On Hawkins, the V-Party score
          // tints the dot warmer; on V-Party, the Hawkins score does the same;
          // on DQI, dot color tracks Hawkins (high H darkens the dot).
          const tintScore =
            axis === "hawkins" ? dot.vScore : axis === "vparty" ? dot.hScore : dot.hScore;
          const fillClass = dotFill(axis, score, tintScore);
          return (
            <Link key={dot.recordId} href={dot.url}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                className={cn("transition-opacity", fillClass, "cursor-pointer hover:opacity-100")}
                opacity={0.85}
              >
                <title>
                  {dot.sessionDate} · H={dot.hScore ?? "—"} V={dot.vScore ?? "—"} DQI=
                  {dot.dqiLevel ?? "—"} · {baseCount} marcheri
                </title>
              </circle>
            </Link>
          );
        })}
      </svg>
      <p className="font-mono-meta mt-1 text-[10px] text-ink-45" data-tabular-nums="">
        {visible.length} discursuri analizate · clic pe punct pentru detalii · raza ∝ log(marcheri)
      </p>
    </div>
  );
}

function yearGuides(
  firstYear: number,
  lastYear: number,
  innerW: number,
  padX: number,
  padY: number,
  innerH: number,
) {
  const xStart = Date.UTC(firstYear, 0, 1);
  const xEnd = Date.UTC(lastYear, 11, 31);
  const guides: React.JSX.Element[] = [];
  const span = lastYear - firstYear + 1;
  // Sparse year labels — every year if ≤ 8 years, else every other year.
  const labelStep = span <= 8 ? 1 : Math.ceil(span / 8);
  for (let y = firstYear; y <= lastYear; y += 1) {
    const t = Date.UTC(y, 0, 1);
    const ratio = xEnd === xStart ? 0.5 : (t - xStart) / (xEnd - xStart);
    const x = padX + ratio * innerW;
    guides.push(
      <line
        key={`y-guide-${y}`}
        x1={x}
        x2={x}
        y1={padY}
        y2={padY + innerH}
        className="stroke-paper-91/50"
        strokeWidth={0.5}
      />,
    );
    if ((y - firstYear) % labelStep === 0) {
      guides.push(
        <text
          key={`y-label-${y}`}
          x={x}
          y={padY + innerH + 18}
          textAnchor="middle"
          className="fill-ink-45 font-mono text-[10px]"
        >
          {y}
        </text>,
      );
    }
  }
  return guides;
}

function monthGuides(year: number, innerW: number, padX: number, padY: number, innerH: number) {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  const guides: React.JSX.Element[] = [];
  for (let i = 0; i < 12; i += 1) {
    const t = Date.UTC(year, i, 1);
    const ratio = (t - yearStart) / (yearEnd - yearStart);
    const x = padX + ratio * innerW;
    guides.push(
      <line
        key={`guide-${i}`}
        x1={x}
        x2={x}
        y1={padY}
        y2={padY + innerH}
        className="stroke-paper-91/50"
        strokeWidth={0.5}
      />,
    );
    if (i % 3 === 0) {
      guides.push(
        <text
          key={`label-${i}`}
          x={x}
          y={padY + innerH + 18}
          textAnchor="middle"
          className="fill-ink-45 font-mono text-[10px]"
        >
          {`${year}-${String(i + 1).padStart(2, "0")}`}
        </text>,
      );
    }
  }
  return guides;
}

function dotFill(
  axis: "hawkins" | "vparty" | "dqi",
  primary: number | null,
  tint: number | null,
): string {
  if (axis === "dqi") {
    if (primary === null) return "fill-paper-91";
    if (primary === 3) return "fill-azure-3";
    if (primary === 2) return "fill-azure-2";
    if (primary === 1) return "fill-azure-1";
    return "fill-paper-91";
  }
  // Hawkins / V-Party share the warm pathology palette. Tint encodes the
  // co-occurring secondary score: H=2 V=2 dots render darkest, H=2 V=0 dots
  // are the lighter warm.
  if (primary === null) return "fill-paper-91";
  if (primary === 0) return "fill-paper-91";
  const intensity = (primary ?? 0) + (tint ?? 0);
  if (intensity >= 4) return "fill-alert-civic";
  if (intensity === 3) return "fill-alert-civic/80";
  if (intensity === 2) return "fill-alert-civic/60";
  return "fill-alert-civic/40";
}

function parseDateUtc(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
