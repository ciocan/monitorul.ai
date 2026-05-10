import Link from "next/link";

import { cn } from "@/lib/utils";

import { markerKindLabel } from "@/lib/discourse-copy";
import type { DiscourseMarkerTreemap } from "@/lib/types";

import { FRAMEWORK_BG_TINT } from "./framework-badge";

// Squarified treemap for marker-kind frequency. Hand-rolled in ~80 LOC. Uses
// the standard squarified algorithm (Bruls et al. 1999): walk items in
// descending order, pack each "row" along the shorter side of the remaining
// rectangle, flip the orientation when the next item degrades the worst aspect
// ratio. Plenty of approximations (no recursive sub-treemaps, no animation),
// matching the page's editorial-restraint register.

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PackedItem {
  framework: "hawkins" | "vparty";
  kind: string;
  count: number;
  rect: Rect;
}

const VB_WIDTH = 1200;
const VB_HEIGHT = 320;

export interface MarkerTreemapProps {
  data: DiscourseMarkerTreemap;
  className?: string;
}

export function MarkerTreemap({ data, className }: MarkerTreemapProps) {
  if (data.items.length === 0) {
    return (
      <div className={cn("border border-paper-91 bg-paper-99 px-3 py-12 text-center", className)}>
        <p className="text-sm text-ink-45">Nu există marcheri pentru acest filtru.</p>
      </div>
    );
  }
  const items = data.items.filter(
    (i): i is { framework: "hawkins" | "vparty"; kind: string; count: number } =>
      i.framework === "hawkins" || i.framework === "vparty",
  );
  const packed = squarify(items, { x: 0, y: 0, w: VB_WIDTH, h: VB_HEIGHT });
  return (
    <div className={cn("border border-paper-91 bg-paper-99 px-3 py-3", className)}>
      <svg
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[280px] w-full"
        role="img"
        aria-label={`Frecvența marcherilor în ${data.year}`}
      >
        {packed.map((p, i) => {
          const tint = p.framework === "hawkins" ? "fill-alert-civic" : "fill-azure-3";
          const opacity = 0.18 + 0.62 * (p.count / data.items[0].count);
          const ratio = p.rect.w / p.rect.h;
          const showLabel = p.rect.w > 80 && p.rect.h > 28;
          return (
            <g key={`${p.framework}-${p.kind}-${i}`}>
              <Link href={`/cauta?q=${encodeURIComponent(markerKindLabel(p.framework, p.kind))}`}>
                <rect
                  x={p.rect.x + 1}
                  y={p.rect.y + 1}
                  width={Math.max(0, p.rect.w - 2)}
                  height={Math.max(0, p.rect.h - 2)}
                  className={cn(tint, "stroke-paper-91 cursor-pointer")}
                  style={{ opacity }}
                >
                  <title>
                    {p.framework} · {markerKindLabel(p.framework, p.kind)} · {p.count} discursuri
                  </title>
                </rect>
              </Link>
              {showLabel ? (
                <>
                  <text
                    x={p.rect.x + 8}
                    y={p.rect.y + 18}
                    className="fill-ink-16 font-display text-[14px]"
                  >
                    {markerKindLabel(p.framework, p.kind)}
                  </text>
                  <text
                    x={p.rect.x + 8}
                    y={p.rect.y + 32}
                    className="fill-ink-45 font-mono text-[10px]"
                  >
                    {p.count} · {p.framework === "hawkins" ? "Hawkins" : "V-Party"} · ratio{" "}
                    {ratio.toFixed(2)}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="font-mono-meta mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-45">
        <span className="inline-flex items-center gap-1">
          <span className={cn("inline-block h-2 w-2", FRAMEWORK_BG_TINT.hawkins)} />
          Hawkins (populism)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn("inline-block h-2 w-2", FRAMEWORK_BG_TINT.vparty)} />
          V-Party (anti-pluralism)
        </span>
        <span>· {data.items.length} marcheri în top · clic = caută</span>
      </div>
    </div>
  );
}

// Squarified treemap layout. Items must be sorted descending by count.
function squarify(
  items: { framework: "hawkins" | "vparty"; kind: string; count: number }[],
  bounds: Rect,
): PackedItem[] {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const totalCount = sorted.reduce((acc, i) => acc + i.count, 0);
  const totalArea = bounds.w * bounds.h;
  const scaled = sorted.map((it) => ({ ...it, area: (it.count / totalCount) * totalArea }));
  const out: PackedItem[] = [];
  layout(scaled, [], bounds, out);
  return out;
}

function worstRatio(row: { area: number }[], side: number): number {
  if (row.length === 0) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((acc, r) => acc + r.area, 0);
  const sumSq = sum * sum;
  const sideSq = side * side;
  let max = 0;
  for (const r of row) {
    const ratio = Math.max((sideSq * r.area) / sumSq, sumSq / (sideSq * r.area));
    if (ratio > max) max = ratio;
  }
  return max;
}

function layout(
  remaining: { framework: "hawkins" | "vparty"; kind: string; count: number; area: number }[],
  row: { framework: "hawkins" | "vparty"; kind: string; count: number; area: number }[],
  rect: Rect,
  out: PackedItem[],
): void {
  if (remaining.length === 0) {
    layoutRow(row, rect, out);
    return;
  }
  const [next, ...rest] = remaining;
  const side = Math.min(rect.w, rect.h);
  if (worstRatio([...row, next], side) <= worstRatio(row, side) || row.length === 0) {
    layout(rest, [...row, next], rect, out);
  } else {
    const newRect = layoutRow(row, rect, out);
    layout(remaining, [], newRect, out);
  }
}

function layoutRow(
  row: { framework: "hawkins" | "vparty"; kind: string; count: number; area: number }[],
  rect: Rect,
  out: PackedItem[],
): Rect {
  if (row.length === 0) return rect;
  const sum = row.reduce((acc, r) => acc + r.area, 0);
  if (rect.w <= rect.h) {
    const rowH = sum / rect.w;
    let cx = rect.x;
    for (const r of row) {
      const itemW = (r.area / sum) * rect.w;
      out.push({
        framework: r.framework,
        kind: r.kind,
        count: r.count,
        rect: { x: cx, y: rect.y, w: itemW, h: rowH },
      });
      cx += itemW;
    }
    return { x: rect.x, y: rect.y + rowH, w: rect.w, h: Math.max(0, rect.h - rowH) };
  }
  const rowW = sum / rect.h;
  let cy = rect.y;
  for (const r of row) {
    const itemH = (r.area / sum) * rect.h;
    out.push({
      framework: r.framework,
      kind: r.kind,
      count: r.count,
      rect: { x: rect.x, y: cy, w: rowW, h: itemH },
    });
    cy += itemH;
  }
  return { x: rect.x + rowW, y: rect.y, w: Math.max(0, rect.w - rowW), h: rect.h };
}
