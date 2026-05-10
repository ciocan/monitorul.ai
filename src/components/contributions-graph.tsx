import { formatDate, pluralRo } from "@/lib/format";
import type { PersonActivityDay, PersonActivityWindow } from "@/lib/types";
import { cn } from "@/lib/utils";

// Signature component (DESIGN.md §5): a 53-week × 7-day calendar heatmap of
// substantive speech days, anchored to the politician's `last_speech_date`.
// Pure SVG so it ships without client JS — `<title>` elements provide native
// hover tooltips that screen readers also surface.

export interface ContributionsGraphProps {
  activity: PersonActivityDay[];
  window: PersonActivityWindow;
  className?: string;
  // When both are set, non-empty cells render as `<a>` links to
  // `/politicieni/<slug>?day=YYYY-MM-DD`. The cell matching `selectedDate`
  // gets a 1px ink-16 stroke so users can see which day they're filtering.
  // Plain `<a>` (not Next `<Link>`, which doesn't render inside SVG) — the
  // App Router intercepts internal navigations regardless.
  slug?: string;
  selectedDate?: string | null;
}

const CELL_SIZE = 11;
const CELL_GAP = 3;
const COL_WIDTH = CELL_SIZE + CELL_GAP;
const ROW_HEIGHT = CELL_SIZE + CELL_GAP;
const DAY_LABEL_WIDTH = 22;
const MONTH_LABEL_HEIGHT = 14;
const FONT_SIZE = 10;

const MONTH_NAMES_RO = [
  "ian",
  "feb",
  "mar",
  "apr",
  "mai",
  "iun",
  "iul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// Romanian week starts on Monday (ISO-8601). Sparse labels (Mon, Wed, Fri) so
// the grid stays readable; matches GitHub's day-axis convention.
const DAY_LABELS_RO: Array<{ row: number; label: string }> = [
  { row: 0, label: "Lu" },
  { row: 2, label: "Mi" },
  { row: 4, label: "Vi" },
];

function intensityClass(count: number): string {
  if (count <= 0) return "fill-paper-91";
  if (count === 1) return "fill-azure-1";
  if (count <= 3) return "fill-azure-2";
  if (count <= 6) return "fill-azure-3";
  return "fill-azure-4";
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function isoFromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Mon = 0, ..., Sun = 6 (ISO-8601 weekday minus one).
function isoWeekday(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

interface DayCell {
  date: string;
  count: number;
}

interface Grid {
  weeks: Array<Array<DayCell | null>>;
  monthLabels: Array<{ x: number; label: string }>;
  totalCount: number;
  activeDays: number;
}

const DAY_MS = 86_400_000;

function buildGrid(activity: PersonActivityDay[], window: PersonActivityWindow): Grid {
  const counts = new Map(activity.map((a) => [a.date, a.count]));
  const fromDate = utcDate(window.from);
  const toDate = utcDate(window.to);

  // Pad to the Monday at or before `from` and the Sunday at or after `to` so
  // every column is a complete 7-cell week. Cells outside the window render
  // as null (visual gaps), keeping the right-edge "future" days unfilled.
  const gridStartMs = fromDate.getTime() - isoWeekday(fromDate) * DAY_MS;
  const gridEndMs = toDate.getTime() + (6 - isoWeekday(toDate)) * DAY_MS;
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();

  const weeks: Array<Array<DayCell | null>> = [];
  const monthLabels: Array<{ x: number; label: string }> = [];
  let lastLabeledMonth = -1;
  let totalCount = 0;
  let activeDays = 0;
  let currentWeek: Array<DayCell | null> = [];

  for (let ms = gridStartMs; ms <= gridEndMs; ms += DAY_MS) {
    const cursor = new Date(ms);
    const inWindow = ms >= fromMs && ms <= toMs;
    if (inWindow) {
      const iso = isoFromUtc(cursor);
      const count = counts.get(iso) ?? 0;
      if (count > 0) {
        totalCount += count;
        activeDays += 1;
      }
      currentWeek.push({ date: iso, count });
    } else {
      currentWeek.push(null);
    }

    // A column "belongs" to the month of its Monday. Emit a label the first
    // time a new month appears so the axis reads left-to-right like a calendar.
    if (isoWeekday(cursor) === 0) {
      const month = cursor.getUTCMonth();
      if (month !== lastLabeledMonth) {
        monthLabels.push({ x: weeks.length * COL_WIDTH, label: MONTH_NAMES_RO[month] });
        lastLabeledMonth = month;
      }
    }

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  return { weeks, monthLabels, totalCount, activeDays };
}

function tooltipFor(dateIso: string, count: number): string {
  const dateLabel = formatDate(dateIso) ?? dateIso;
  if (count === 0) return `Fără discursuri · ${dateLabel}`;
  return `${pluralRo(count, "discurs", "discursuri", "de discursuri")} · ${dateLabel}`;
}

function rangeLabel(window: PersonActivityWindow): string {
  const from = formatDate(window.from);
  const to = formatDate(window.to);
  if (!from || !to) return "";
  return `${from} – ${to}`;
}

export function ContributionsGraph({
  activity,
  window,
  className,
  slug,
  selectedDate,
}: ContributionsGraphProps) {
  const grid = buildGrid(activity, window);
  const innerWidth = grid.weeks.length * COL_WIDTH - CELL_GAP;
  const width = DAY_LABEL_WIDTH + innerWidth;
  const height = MONTH_LABEL_HEIGHT + 7 * ROW_HEIGHT - CELL_GAP;
  const range = rangeLabel(window);
  const ariaLabel = `Calendar de activitate parlamentară: ${pluralRo(grid.totalCount, "discurs", "discursuri", "de discursuri")} pe ${pluralRo(grid.activeDays, "zi", "zile", "de zile")} din intervalul ${range}.`;

  return (
    <figure className={cn("not-italic", className)}>
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span
          className="font-mono-meta text-xs text-ink-45"
          data-tabular-nums=""
          aria-hidden="true"
        >
          {range}
        </span>
        <span className="font-mono-meta text-xs text-ink-30" data-tabular-nums="">
          {pluralRo(grid.totalCount, "discurs", "discursuri", "de discursuri")} ·{" "}
          {pluralRo(grid.activeDays, "zi activă", "zile active", "de zile active")}
        </span>
      </figcaption>

      <div className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="block"
        >
          {grid.monthLabels.map((m, i) => (
            <text
              key={`${m.x}-${i}`}
              x={DAY_LABEL_WIDTH + m.x}
              y={MONTH_LABEL_HEIGHT - 4}
              fontSize={FONT_SIZE}
              className="fill-ink-45 font-mono"
            >
              {m.label}
            </text>
          ))}

          {DAY_LABELS_RO.map(({ row, label }) => (
            <text
              key={row}
              x={0}
              y={MONTH_LABEL_HEIGHT + row * ROW_HEIGHT + CELL_SIZE - 2}
              fontSize={FONT_SIZE}
              className="fill-ink-45 font-mono"
            >
              {label}
            </text>
          ))}

          {grid.weeks.map((week, x) =>
            week.map((cell, y) => {
              if (!cell) return null;
              const isSelected = selectedDate === cell.date;
              const cellX = DAY_LABEL_WIDTH + x * COL_WIDTH;
              const cellY = MONTH_LABEL_HEIGHT + y * ROW_HEIGHT;
              const tooltip = tooltipFor(cell.date, cell.count);
              const rect = (
                <rect
                  x={cellX}
                  y={cellY}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={1}
                  className={cn(
                    intensityClass(cell.count),
                    isSelected && "stroke-ink-16 [stroke-width:1.5]",
                  )}
                >
                  <title>{tooltip}</title>
                </rect>
              );
              if (slug && cell.count > 0) {
                return (
                  <a
                    key={`${x}-${y}`}
                    href={`/politicieni/${slug}?day=${cell.date}`}
                    aria-label={tooltip}
                    style={{ cursor: "pointer" }}
                  >
                    {rect}
                  </a>
                );
              }
              return <g key={`${x}-${y}`}>{rect}</g>;
            }),
          )}
        </svg>
      </div>

      <div
        className="mt-3 flex items-center justify-end gap-2 font-mono-meta text-xs text-ink-45"
        data-tabular-nums=""
      >
        <span>Mai puține</span>
        <svg
          width={5 * COL_WIDTH - CELL_GAP}
          height={CELL_SIZE}
          viewBox={`0 0 ${5 * COL_WIDTH - CELL_GAP} ${CELL_SIZE}`}
          aria-hidden="true"
          className="block"
        >
          {[0, 1, 3, 6, 10].map((c, i) => (
            <rect
              key={c}
              x={i * COL_WIDTH}
              y={0}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={1}
              className={intensityClass(c)}
            />
          ))}
        </svg>
        <span>Mai multe</span>
      </div>
    </figure>
  );
}
