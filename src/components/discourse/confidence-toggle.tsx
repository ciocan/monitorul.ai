import Link from "next/link";

import { cn } from "@/lib/utils";
import { withDiscourseParams } from "@/lib/discourse-params";

// Two-state chip toggle paired with `<VoiceToggle>`: `Toate codările` vs
// `Doar ≥ 0.7`. Default is "all codings" — the per-marker confidence dot
// (`<ConfidenceDot>`) does the per-row honesty work. The chip is for
// publication-grade aggregations (matches canonical-queries.md threshold).

export interface ConfidenceToggleProps {
  basePath: string;
  searchParams: URLSearchParams;
  confidenceMin: number | null;
  className?: string;
}

export function ConfidenceToggle({
  basePath,
  searchParams,
  confidenceMin,
  className,
}: ConfidenceToggleProps) {
  const allHref = buildHref(basePath, withDiscourseParams(searchParams, { confidenceMin: null }));
  const minHref = buildHref(basePath, withDiscourseParams(searchParams, { confidenceMin: 0.7 }));
  return (
    <span
      className={cn("inline-flex items-center gap-px border border-paper-91 text-xs", className)}
      role="group"
      aria-label="Filtru de încredere"
    >
      <Chip href={allHref} active={confidenceMin === null}>
        Toate codările
      </Chip>
      <Chip href={minHref} active={confidenceMin === 0.7}>
        Doar ≥ 0.7
      </Chip>
      <span
        className="px-1 text-ink-45"
        title="Pragul ≥ 0.7 este standardul publicării (vezi /despre). Default ‘toate codările’ + bule de încredere per-marker pentru explorare."
        aria-hidden="true"
      >
        ⓘ
      </span>
    </span>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "px-2 py-1 transition-colors",
        active ? "bg-ink-16 text-paper-99" : "text-ink-30 hover:bg-paper-96 hover:text-ink-16",
      )}
    >
      {children}
    </Link>
  );
}

function buildHref(basePath: string, sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
