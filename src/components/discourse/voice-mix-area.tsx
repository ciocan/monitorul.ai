import { cn } from "@/lib/utils";

import { voiceLabel } from "@/lib/discourse-copy";
import type { DiscourseVoice, DiscourseVoiceMix } from "@/lib/types";

// Stacked-area-style voice mix per month. Voice is a meta-classifier on
// markers, not a 0–2 score axis — its trajectory makes more sense as
// "how does the speaker's voice profile evolve" than as score-bars. We render
// each month as a single tall column with stacked voice bands; the eye
// should read it as "azure first-person dominates" or "italic apophasis is
// climbing in 2024".

const VOICE_ORDER: DiscourseVoice[] = [
  "speaker_first_person",
  "quoted",
  "reported",
  "negated",
  "apophasis_disclaimed",
  "weasel_attribution",
  "hypothetical",
  "sarcastic",
  "interrogative",
  "uncertain",
];

const VOICE_FILL: Record<DiscourseVoice, string> = {
  speaker_first_person: "bg-azure-3",
  quoted: "bg-paper-91",
  reported: "bg-paper-91",
  negated: "bg-ink-45",
  apophasis_disclaimed: "bg-azure-1",
  weasel_attribution: "bg-azure-1",
  hypothetical: "bg-paper-91",
  sarcastic: "bg-azure-2",
  interrogative: "bg-azure-2",
  uncertain: "bg-paper-96",
};

const MONTH_LABELS_RO = ["I", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"];

export interface VoiceMixAreaProps {
  voiceMix: DiscourseVoiceMix[];
  granularity: "month" | "year";
  year: number | null;
  yearRange?: { first: number | null; last: number | null };
  className?: string;
}

export function VoiceMixArea({
  voiceMix,
  granularity,
  year,
  yearRange,
  className,
}: VoiceMixAreaProps) {
  const buckets =
    granularity === "month"
      ? buildMonthBuckets(voiceMix, year)
      : buildYearBuckets(voiceMix, yearRange);
  const labels =
    granularity === "month"
      ? MONTH_LABELS_RO
      : buckets.map((b) => String(Number.parseInt(b.month, 10) % 100).padStart(2, "0"));
  const maxTotal = Math.max(1, ...buckets.map((m) => m.total));
  const barAreaH = 100;
  // For the legend: which voices appear at all in this window?
  const seen = new Set<DiscourseVoice>();
  for (const m of buckets) {
    for (const v of Object.keys(m.totals)) seen.add(v as DiscourseVoice);
  }
  const ariaLabel =
    granularity === "month"
      ? `Mixul de voce, lunar, ${year ?? ""}`
      : `Mixul de voce, anual, întreaga carieră`;
  return (
    <div
      className={cn("border border-paper-91 bg-paper-99 px-3 pt-3 pb-2", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="flex items-end gap-1">
        {buckets.map((m, i) => {
          const totalH = m.total === 0 ? 0 : Math.max(2, (m.total / maxTotal) * barAreaH);
          return (
            <div
              key={m.month}
              className="flex min-w-0 flex-1 flex-col items-center"
              title={tooltip(m)}
            >
              <div
                className="flex w-full flex-col items-stretch overflow-hidden"
                style={{ height: barAreaH }}
              >
                <div style={{ flex: `0 0 ${barAreaH - totalH}px` }} />
                {VOICE_ORDER.map((v) => {
                  const c = m.totals[v] ?? 0;
                  if (c === 0) return null;
                  const h = (c / Math.max(m.total, 1)) * totalH;
                  return <div key={v} style={{ height: h }} className={cn(VOICE_FILL[v])} />;
                })}
              </div>
              <span
                className="font-mono-meta mt-1 text-[10px] text-ink-45 select-none"
                style={{ height: 18 }}
              >
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="font-mono-meta mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-45">
        {VOICE_ORDER.filter((v) => seen.has(v)).map((v) => (
          <span key={v} className="inline-flex items-center gap-1">
            <span className={cn("inline-block h-2 w-2", VOICE_FILL[v])} />
            <span>{voiceLabel(v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function tooltip(m: DiscourseVoiceMix): string {
  const parts = Object.entries(m.totals)
    .filter(([, n]) => (typeof n === "number" ? n > 0 : false))
    .map(([k, n]) => `${k}:${n}`);
  return `${m.month} · total ${m.total} · ${parts.join(" ")}`;
}

const EMPTY_VOICE_MIX = (key: string): DiscourseVoiceMix => ({ month: key, totals: {}, total: 0 });

function buildMonthBuckets(
  voiceMix: DiscourseVoiceMix[],
  year: number | null,
): DiscourseVoiceMix[] {
  const y = year ?? new Date().getUTCFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${y}-${String(i + 1).padStart(2, "0")}`;
    return voiceMix.find((m) => m.month === key) ?? EMPTY_VOICE_MIX(key);
  });
}

function buildYearBuckets(
  voiceMix: DiscourseVoiceMix[],
  yearRange: VoiceMixAreaProps["yearRange"],
): DiscourseVoiceMix[] {
  const dataYears = voiceMix
    .map((m) => Number.parseInt(m.month, 10))
    .filter((n) => Number.isFinite(n));
  const first = yearRange?.first ?? (dataYears.length > 0 ? Math.min(...dataYears) : null);
  const last = yearRange?.last ?? (dataYears.length > 0 ? Math.max(...dataYears) : null);
  if (first === null || last === null) return voiceMix;
  const result: DiscourseVoiceMix[] = [];
  for (let y = first; y <= last; y += 1) {
    const key = String(y);
    result.push(voiceMix.find((m) => m.month === key) ?? EMPTY_VOICE_MIX(key));
  }
  return result;
}
