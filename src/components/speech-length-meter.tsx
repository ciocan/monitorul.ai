import { formatCount, speechSize, type SpeechSize } from "@/lib/format";
import { cn } from "@/lib/utils";

// At-a-glance meter for a speech row: word count + 5-segment azure bar that
// graduates with size (xs/s/m/l/xl). The graduated palette mirrors the
// contributions graph's `fill-azure-1`…`fill-azure-4` intensity scale, so
// the meter reads as "lighter = shorter, darker = longer" alongside the
// segment count. Word count is derived client-side from `speech.text`,
// which is already in the `_source` payloads driving the calling pages —
// rendering this adds no Elasticsearch cost.

const SIZE_FILL_LEVEL: Record<SpeechSize, number> = {
  xs: 1,
  s: 2,
  m: 3,
  l: 4,
  xl: 5,
};

const SEGMENT_FILL_CLASS = [
  "bg-azure-1",
  "bg-azure-2",
  "bg-azure-3",
  "bg-azure-4",
  "bg-azure-5",
] as const;

export interface SpeechLengthMeterProps {
  wordCount: number;
  className?: string;
}

export function SpeechLengthMeter({ wordCount, className }: SpeechLengthMeterProps) {
  if (wordCount <= 0) return null;
  const size = speechSize(wordCount);
  const filled = SIZE_FILL_LEVEL[size];
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
        {formatCount(wordCount)} cuvinte
      </span>
      <span
        className="flex items-center gap-px"
        role="img"
        aria-label={`Mărime: ${size.toUpperCase()} (${filled} din 5)`}
        title={`Mărime: ${size.toUpperCase()}`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn("block h-2 w-1.5", i < filled ? SEGMENT_FILL_CLASS[i] : "bg-paper-91")}
          />
        ))}
      </span>
    </span>
  );
}
