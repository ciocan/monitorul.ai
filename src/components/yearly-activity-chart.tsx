import Link from "next/link";

import { formatCount, pluralRo } from "@/lib/format";
import type { PersonYearCount } from "@/lib/types";
import { cn } from "@/lib/utils";

// Signature component: a per-year sparkbar that doubles as the year picker
// for the contributions heatmap below it. Each column is a `<Link>` to the
// same person URL with `?year=YYYY`; the heatmap re-renders for that year on
// the server. `scroll={false}` keeps the viewport pinned so the user can
// rapidly skim career rhythms without losing the heatmap from view.

export interface YearlyActivityChartProps {
  yearlyCounts: PersonYearCount[];
  selectedYear: number;
  slug: string;
  className?: string;
}

const BAR_WIDTH = 12;
const BAR_GAP = 3;
const BAR_MAX_HEIGHT = 60;
const BAR_MIN_HEIGHT = 2;

function fillYearGaps(counts: PersonYearCount[], selectedYear: number): PersonYearCount[] {
  if (counts.length === 0) return [{ year: selectedYear, count: 0 }];
  const min = Math.min(counts[0].year, selectedYear);
  const max = Math.max(counts.at(-1)?.year ?? selectedYear, selectedYear);
  const map = new Map(counts.map((c) => [c.year, c.count]));
  const filled: PersonYearCount[] = [];
  for (let y = min; y <= max; y++) {
    filled.push({ year: y, count: map.get(y) ?? 0 });
  }
  return filled;
}

function shortYear(year: number): string {
  return String(year).slice(-2);
}

export function YearlyActivityChart({
  yearlyCounts,
  selectedYear,
  slug,
  className,
}: YearlyActivityChartProps) {
  const series = fillYearGaps(yearlyCounts, selectedYear);
  const max = series.reduce((m, c) => Math.max(m, c.count), 0);

  return (
    <nav
      aria-label="Selectează anul activității"
      className={cn("border-y border-border py-4", className)}
    >
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
            const label =
              entry.count === 0
                ? `${entry.year}: fără discursuri`
                : `${entry.year}: ${pluralRo(entry.count, "discurs", "discursuri", "de discursuri")}`;
            const href = `/politicieni/${slug}?year=${entry.year}`;
            return (
              <li key={entry.year} className="flex flex-col items-center">
                <Link
                  href={href}
                  scroll={false}
                  prefetch={false}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`Vezi activitatea din anul ${entry.year}: ${formatCount(entry.count)} ${entry.count === 1 ? "discurs" : "discursuri"}`}
                  title={label}
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
