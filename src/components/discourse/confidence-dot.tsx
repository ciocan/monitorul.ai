import { cn } from "@/lib/utils";

// Three-state confidence indicator from Q4 of the discourse-UI grill: a small
// dot whose fill encodes the framework / marker confidence band. Used inline
// next to marker chips (`evil_elite ×14 ●●●`) and on side-panel cards.
//
//   ≥ 0.8   azure-3 saturated (high)
//   0.6-0.8 azure-1 lighter   (medium)
//   < 0.6   paper-91 muted    (low)
//
// `null` / undefined renders an empty slot — the component never reads a
// missing confidence as "low".

const HIGH = 0.8;
const MID = 0.6;

export interface ConfidenceDotProps {
  confidence: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

export function ConfidenceDot({ confidence, size = "sm", label, className }: ConfidenceDotProps) {
  const dim = size === "md" ? "size-2.5" : "size-2";
  const fill = bandFill(confidence);
  const ariaLabel = label ?? bandLabel(confidence);
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn("inline-block rounded-full", dim, fill, className)}
    />
  );
}

function bandFill(c: number | null | undefined): string {
  if (typeof c !== "number") return "bg-paper-91";
  if (c >= HIGH) return "bg-azure-3";
  if (c >= MID) return "bg-azure-1";
  return "bg-paper-91";
}

function bandLabel(c: number | null | undefined): string {
  if (typeof c !== "number") return "Încredere necunoscută";
  if (c >= HIGH) return `Încredere ridicată (${c.toFixed(2)})`;
  if (c >= MID) return `Încredere medie (${c.toFixed(2)})`;
  return `Încredere scăzută (${c.toFixed(2)})`;
}
