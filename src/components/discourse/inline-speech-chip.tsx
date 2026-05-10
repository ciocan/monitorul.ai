import { cn } from "@/lib/utils";

import type { DocumentSpeechSummary } from "@/lib/document-discourse";

import { ConfidenceDot } from "./confidence-dot";

// Compact `[H=N V=N DQI=L*]` chip rendered after a speaker's name in the
// document body. Hidden when the speech has no discourse data OR when every
// framework score is zero (keeps the body clean for boring procedural turns).

export interface InlineSpeechChipProps {
  summary: DocumentSpeechSummary;
  className?: string;
}

export function InlineSpeechChip({ summary, className }: InlineSpeechChipProps) {
  const allZero =
    (summary.hScore ?? 0) === 0 && (summary.vScore ?? 0) === 0 && (summary.dqiLevel ?? 0) === 0;
  if (allZero) return null;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 border border-paper-91 bg-paper-99 px-1.5 py-0.5 font-mono-meta text-[11px] text-ink-30",
        className,
      )}
      data-tabular-nums=""
      title={tooltip(summary)}
    >
      <ScoreSlot label="H" value={summary.hScore} accent="alert" />
      <ScoreSlot label="V" value={summary.vScore} accent="alert" />
      <ScoreSlot label="L" value={summary.dqiLevel} accent="azure" />
      <ConfidenceDot confidence={null} className="opacity-0" />
    </span>
  );
}

function ScoreSlot({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | null;
  accent: "alert" | "azure";
}) {
  if (value === null) {
    return (
      <span className="text-ink-45">
        {label}=<span className="text-ink-45">—</span>
      </span>
    );
  }
  const tone =
    value === 0
      ? "text-ink-45"
      : accent === "alert"
        ? value === 2
          ? "text-alert-civic"
          : "text-alert-civic/80"
        : "text-azure-3";
  return (
    <span className={cn(tone)}>
      {label}={value}
    </span>
  );
}

function tooltip(s: DocumentSpeechSummary): string {
  return [
    s.hScore !== null ? `Hawkins=${s.hScore} (${s.hawkinsMarkers} marcheri)` : "Hawkins —",
    s.vScore !== null ? `V-Party=${s.vScore} (${s.vpartyMarkers} marcheri)` : "V-Party —",
    s.dqiLevel !== null ? `DQI L${s.dqiLevel}` : "DQI —",
    `voce: ${s.dominantVoice}`,
  ].join(" · ");
}
