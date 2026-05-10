import { cn } from "@/lib/utils";

import { frameworkLabel } from "@/lib/discourse-copy";
import type { DiscourseFramework } from "@/lib/types";

// Label for one of the four discourse frameworks. Color-coded by framework
// per the design tokens: Hawkins / V-Party render in `alert-civic` (warning
// register, both are pathology axes); DQI in `azure-3` (cool, deliberative
// quality is the positive axis); Voce in `ink-30` (neutral, voice is a
// meta-classifier on top of the other markers). Same palette is used by
// every other discourse component so the framework reads consistently across
// the speech / politician / document / stats surfaces.

export const FRAMEWORK_FG: Record<DiscourseFramework, string> = {
  hawkins: "text-alert-civic",
  vparty: "text-alert-civic",
  dqi: "text-azure-3",
  voice: "text-ink-30",
};

export const FRAMEWORK_BORDER: Record<DiscourseFramework, string> = {
  hawkins: "border-alert-civic/40",
  vparty: "border-alert-civic/40",
  dqi: "border-azure-3/40",
  voice: "border-ink-45/40",
};

export const FRAMEWORK_BG_TINT: Record<DiscourseFramework, string> = {
  hawkins: "bg-alert-civic/8",
  vparty: "bg-alert-civic/8",
  dqi: "bg-azure-3/8",
  voice: "bg-paper-96",
};

export interface FrameworkBadgeProps {
  framework: DiscourseFramework;
  long?: boolean;
  // Compact = mono-uppercase chip (suits the document page top strip).
  variant?: "default" | "mono-uppercase";
  className?: string;
}

export function FrameworkBadge({
  framework,
  long = false,
  variant = "default",
  className,
}: FrameworkBadgeProps) {
  const label = frameworkLabel(framework, long);
  if (variant === "mono-uppercase") {
    return (
      <span className={cn("label-mono inline-block", FRAMEWORK_FG[framework], className)}>
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-none border px-1.5 py-0.5 text-xs",
        FRAMEWORK_FG[framework],
        FRAMEWORK_BORDER[framework],
        className,
      )}
    >
      {label}
    </span>
  );
}
