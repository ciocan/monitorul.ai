import Link from "next/link";

import { cn } from "@/lib/utils";

import type { DiscourseTopPoliticiansPayload } from "@/lib/types";

// Compact ranked list for the stats page. Renders the 95% Wilson interval as
// an inline bar; cells link to the politician page (with the year preserved).

const AXIS_TITLE = {
  hawkins: "Top H ≥ 1 (populism)",
  vparty: "Top V ≥ 1 (anti-pluralism)",
  dqi: "Top DQI ≥ L2 (calitate deliberativă)",
} as const;

const AXIS_RATE_LABEL = {
  hawkins: "rate H ≥ 1",
  vparty: "rate V ≥ 1",
  dqi: "rate DQI ≥ 2",
} as const;

export interface MiniRankingTableProps {
  data: DiscourseTopPoliticiansPayload;
  className?: string;
}

export function MiniRankingTable({ data, className }: MiniRankingTableProps) {
  return (
    <div className={cn("border border-paper-91 bg-paper-99 px-3 py-3", className)}>
      <header className="mb-2">
        <p className="label-mono text-ink-30">{AXIS_TITLE[data.axis]}</p>
        <p className="font-mono-meta text-[11px] text-ink-45" data-tabular-nums="">
          {data.year} · interval Wilson 95%
        </p>
      </header>
      {data.rows.length === 0 ? (
        <p className="text-sm text-ink-45">Nu există politicieni eligibili pentru acest filtru.</p>
      ) : (
        <ol className="divide-y divide-border">
          {data.rows.map((row, idx) => (
            <li key={row.personId} className="flex items-baseline gap-3 py-1.5">
              <span
                className="font-mono-meta w-6 shrink-0 text-right text-xs text-ink-45"
                data-tabular-nums=""
              >
                {idx + 1}
              </span>
              <Link
                href={`/politicieni/${row.personId}?year=${data.year}`}
                className="min-w-0 flex-1 truncate text-sm text-ink-16 underline decoration-transparent underline-offset-4 hover:decoration-ink-30"
                title={row.name}
              >
                {row.name}
              </Link>
              <CIBar lo={row.ciLow} hi={row.ciHigh} mid={row.ge1Rate} />
              <span
                className="font-mono-meta w-14 shrink-0 text-right text-xs tabular-nums text-ink-30"
                data-tabular-nums=""
              >
                {Math.round(row.ge1Rate * 100)}%
              </span>
              <span
                className="font-mono-meta w-12 shrink-0 text-right text-[11px] text-ink-45"
                data-tabular-nums=""
                title={`${row.ge1Count}/${row.speechCount}`}
              >
                {row.speechCount}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="font-mono-meta mt-2 text-[10px] text-ink-45">
        coloana ultimă = total discursuri analizate · {AXIS_RATE_LABEL[data.axis]}
      </p>
    </div>
  );
}

function CIBar({ lo, hi, mid }: { lo: number; hi: number; mid: number }) {
  const xLo = Math.max(0, Math.min(1, lo)) * 100;
  const xHi = Math.max(0, Math.min(1, hi)) * 100;
  const width = Math.max(xHi - xLo, 1);
  const xMid = Math.max(0, Math.min(1, mid)) * 100;
  return (
    <span
      className="relative inline-block h-2 w-24 shrink-0 bg-paper-91"
      title={`Wilson 95%: [${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`}
    >
      <span
        className="absolute top-0 h-2 bg-alert-civic/40"
        style={{ left: `${xLo}%`, width: `${width}%` }}
      />
      <span className="absolute top-0 h-2 w-px bg-alert-civic" style={{ left: `${xMid}%` }} />
    </span>
  );
}
