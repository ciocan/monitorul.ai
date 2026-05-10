import Link from "next/link";

import { cn } from "@/lib/utils";

import type { DiscourseCoverage } from "@/lib/types";

// Multi-year coverage strip rendered ABOVE the framework chart. Two-band
// visual: a per-year "total speeches" baseline (thin paper-91) and the
// "coded fraction" overlay (azure). When the user navigates to a year that
// has no coding (e.g. 2018), the overlay is empty for that band — making
// the gap honest. Each year is clickable: navigates to ?year=YYYY,
// preserving every other URL param.

export interface CoverageBandProps {
  coverage: DiscourseCoverage;
  basePath: string;
  searchParams: URLSearchParams;
  selectedYear: number;
  className?: string;
}

export function CoverageBand({
  coverage,
  basePath,
  searchParams,
  selectedYear,
  className,
}: CoverageBandProps) {
  if (coverage.yearly.length === 0) return null;
  const maxTotal = Math.max(1, ...coverage.yearly.map((y) => y.total));
  const codedRatio =
    coverage.totalSubstantive > 0
      ? Math.round((coverage.codedSubstantive / coverage.totalSubstantive) * 100)
      : 0;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="label-mono text-ink-30">Acoperire pe an</p>
        <p
          className="font-mono-meta text-xs text-ink-45"
          data-tabular-nums=""
          title={`${coverage.codedSubstantive} din ${coverage.totalSubstantive} discursuri analizate (${codedRatio}%)`}
        >
          {coverage.codedSubstantive.toLocaleString("ro-RO")} din{" "}
          {coverage.totalSubstantive.toLocaleString("ro-RO")} analizate · {codedRatio}%
        </p>
      </div>
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {coverage.yearly.map((y) => {
          const sp = new URLSearchParams(searchParams);
          if (y.year === coverage.yearly.at(-1)?.year) sp.delete("year");
          else sp.set("year", String(y.year));
          // Avoid pinning year for the "default" most-recent year — keeps
          // the URL terse on the most common case.
          if (y.year === selectedYear && y.year === coverage.yearly.at(-1)?.year) sp.delete("year");
          else if (y.year === selectedYear) sp.set("year", String(y.year));
          else sp.set("year", String(y.year));
          const qs = sp.toString();
          const href = qs ? `${basePath}?${qs}` : basePath;
          const totalH = Math.max(2, (y.total / maxTotal) * 56);
          const codedFraction = y.total > 0 ? y.coded / y.total : 0;
          const codedH = Math.max(0, codedFraction * totalH);
          const active = y.year === selectedYear;
          return (
            <Link
              key={y.year}
              href={href}
              aria-current={active ? "true" : undefined}
              title={`${y.year} · ${y.coded} din ${y.total} analizate`}
              className={cn(
                "group/year flex w-9 flex-col items-center rounded-none px-0.5 transition-opacity hover:opacity-100",
                active ? "opacity-100" : "opacity-80",
              )}
            >
              <div
                className={cn(
                  "flex w-full flex-col items-stretch overflow-hidden border-b",
                  active ? "border-ink-30" : "border-paper-91",
                )}
                style={{ height: 60 }}
              >
                <div style={{ flex: `0 0 ${60 - totalH}px` }} />
                {y.coded === 0 ? (
                  <div
                    className="bg-paper-91"
                    style={{
                      height: totalH,
                      backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 4px)",
                    }}
                    aria-label="neanalizat"
                  />
                ) : (
                  <>
                    <div className="bg-paper-91" style={{ height: totalH - codedH }} />
                    <div className="bg-azure-3/80" style={{ height: codedH }} />
                  </>
                )}
              </div>
              <span
                className={cn(
                  "font-mono-meta mt-1 text-[10px]",
                  active ? "text-ink-30" : "text-ink-45",
                )}
                data-tabular-nums=""
              >
                {y.year}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="font-mono-meta text-[10px] text-ink-45">
        Bara <span className="bg-azure-3/80 px-1 text-paper-99">azură</span> = analizat · zonă
        hașurată = neanalizat încă (acoperire curentă: martie 2023 →)
      </p>
    </div>
  );
}
