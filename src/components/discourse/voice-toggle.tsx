import Link from "next/link";

import { cn } from "@/lib/utils";
import { withDiscourseParams } from "@/lib/discourse-params";

// Two-state chip toggle: `Vocea proprie` vs `Toate vocile`. Soft-navigates by
// editing the page URL — no client JS required, no flicker, share-link works.
// The active state reads from the props passed by the page (which came from
// the URL via `parseDiscourseParams`).
//
// Schema Q5 default is `speaker_first_person` everywhere; the toggle exists to
// surface the deniable-wrapper / quoted-rhetoric class without making it the
// default. The accessible label includes the rationale so screen readers
// hear *why* one mode is the default.

export interface VoiceToggleProps {
  basePath: string;
  searchParams: URLSearchParams;
  voiceMode: "first-person" | "all";
  className?: string;
}

export function VoiceToggle({ basePath, searchParams, voiceMode, className }: VoiceToggleProps) {
  const firstHref = buildHref(
    basePath,
    withDiscourseParams(searchParams, { voiceMode: "first-person" }),
  );
  const allHref = buildHref(basePath, withDiscourseParams(searchParams, { voiceMode: "all" }));
  return (
    <span
      className={cn("inline-flex items-center gap-px border border-paper-91 text-xs", className)}
      role="group"
      aria-label="Filtru voce: implicit, doar marcheri în vocea proprie a vorbitorului; toate vocile include citate, vorbire indirectă, negări și apofază"
    >
      <Chip href={firstHref} active={voiceMode === "first-person"}>
        Vocea proprie
      </Chip>
      <Chip href={allHref} active={voiceMode === "all"}>
        Toate vocile
      </Chip>
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
      scroll={false}
      prefetch={false}
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
