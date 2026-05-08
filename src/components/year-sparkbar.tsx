import Link from "next/link";

import { pluralRo } from "@/lib/format";
import { cn } from "@/lib/utils";

// Generic per-year sparkbar that doubles as a year picker for the section
// below it. Used by `/mo` (per-year session counts) and `/politicieni`
// (per-year speech counts). Each column is a server-rendered `<Link>` —
// `scroll={false}` keeps the viewport pinned so users can rapidly skim
// without losing the list from view.
//
// `YearlyActivityChart` (src/components/yearly-activity-chart.tsx) renders
// the same visual on `/politicieni/[slug]`; it predates this component and
// is left untouched to avoid churning a shipping page. Future consolidation
// can fold it into this one.

export interface YearSparkbarEntry {
  year: number;
  count: number;
}

export interface YearSparkbarProps {
  yearlyCounts: YearSparkbarEntry[];
  selectedYear: number;
  hrefForYear: (year: number) => string;
  navAriaLabel: string;
  // Romanian plural forms for the count noun, threaded into per-bar aria
  // labels so screen readers hear "Anul 2024: 209 sesiuni" rather than
  // "Anul 2024: 209".
  countNoun: { one: string; few: string; many: string };
  className?: string;
}

const BAR_WIDTH = 12;
const BAR_GAP = 3;
const BAR_MAX_HEIGHT = 60;
const BAR_MIN_HEIGHT = 2;

function shortYear(year: number): string {
  return String(year).slice(-2);
}

function fillYearGaps(counts: YearSparkbarEntry[], selectedYear: number): YearSparkbarEntry[] {
  if (counts.length === 0) return [{ year: selectedYear, count: 0 }];
  const min = Math.min(counts[0].year, selectedYear);
  const max = Math.max(counts.at(-1)?.year ?? selectedYear, selectedYear);
  const map = new Map(counts.map((c) => [c.year, c.count]));
  const filled: YearSparkbarEntry[] = [];
  for (let y = min; y <= max; y++) {
    filled.push({ year: y, count: map.get(y) ?? 0 });
  }
  return filled;
}

export function YearSparkbar({
  yearlyCounts,
  selectedYear,
  hrefForYear,
  navAriaLabel,
  countNoun,
  className,
}: YearSparkbarProps) {
  const series = fillYearGaps(yearlyCounts, selectedYear);
  const max = series.reduce((m, c) => Math.max(m, c.count), 0);
  return (
    <nav aria-label={navAriaLabel} className={cn("border-y border-border py-4", className)}>
      <div className="overflow-x-auto pb-1">
        <ol
          className="flex items-end"
          style={{ gap: `${BAR_GAP}px`, minHeight: `${BAR_MAX_HEIGHT + 18}px` }}
        >
          {series.map((entry) => {
            const isSelected = entry.year === selectedYear;
            const ratio = max > 0 ? entry.count / max : 0;
            const barHeight =
              entry.count > 0
                ? Math.max(BAR_MIN_HEIGHT, Math.round(ratio * BAR_MAX_HEIGHT))
                : BAR_MIN_HEIGHT;
            const ariaLabel =
              entry.count === 0
                ? `Anul ${entry.year}: fără ${countNoun.few}`
                : `Anul ${entry.year}: ${pluralRo(entry.count, countNoun.one, countNoun.few, countNoun.many)}`;
            return (
              <li key={entry.year} className="flex flex-col items-center">
                <Link
                  href={hrefForYear(entry.year)}
                  scroll={false}
                  prefetch={false}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={ariaLabel}
                  title={ariaLabel}
                  className="group flex flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block transition-colors",
                      entry.count === 0
                        ? cn(
                            "bg-paper-91",
                            !isSelected && "group-hover:bg-paper-91/80",
                            isSelected && "bg-azure-4",
                          )
                        : isSelected
                          ? "bg-azure-4"
                          : "bg-azure-2 group-hover:bg-azure-3",
                    )}
                    style={{ width: `${BAR_WIDTH}px`, height: `${barHeight}px` }}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "label-mono mt-2 transition-colors",
                      isSelected ? "text-ink-16" : "text-ink-45 group-hover:text-ink-30",
                    )}
                    style={{
                      width: `${BAR_WIDTH}px`,
                      textAlign: "center",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {shortYear(entry.year)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
