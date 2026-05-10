import { cn } from "@/lib/utils";

import { markerKindLabel } from "@/lib/discourse-copy";
import type { DiscourseFramework } from "@/lib/types";

import { ConfidenceDot } from "./confidence-dot";
import { FRAMEWORK_BORDER, FRAMEWORK_FG } from "./framework-badge";

// Marker chip for either inline text reference (next to a speaker label,
// inside a Cuprins title) or list rendering (top-3 in the document stat
// strip). Carries optional count + confidence dot.
//
// Three visual modes:
//   - "kind" — just the kind label, e.g. "elită coruptă"
//   - "kind-count" — kind label + numeric count, e.g. "elită coruptă ×14"
//   - "framework-kind" — framework prefix + kind, e.g. "[Hawkins] elită coruptă"

export interface MarkerChipProps {
  framework: DiscourseFramework;
  kind: string;
  count?: number;
  confidence?: number | null;
  variant?: "kind" | "kind-count" | "framework-kind";
  className?: string;
}

export function MarkerChip({
  framework,
  kind,
  count,
  confidence,
  variant = "kind",
  className,
}: MarkerChipProps) {
  const label = markerKindLabel(framework, kind);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-none border px-1.5 py-0.5 text-xs",
        FRAMEWORK_FG[framework],
        FRAMEWORK_BORDER[framework],
        className,
      )}
    >
      {variant === "framework-kind" ? (
        <span className="font-mono-meta text-[10px] uppercase opacity-70">
          {framework === "hawkins"
            ? "H"
            : framework === "vparty"
              ? "V"
              : framework === "dqi"
                ? "D"
                : "V·"}
        </span>
      ) : null}
      <span>{label}</span>
      {variant === "kind-count" && typeof count === "number" ? (
        <span className="font-mono-meta text-ink-45 text-[11px]" data-tabular-nums="">
          ×{count}
        </span>
      ) : null}
      {typeof confidence === "number" ? (
        <ConfidenceDot confidence={confidence} className="ml-0.5" />
      ) : null}
    </span>
  );
}
