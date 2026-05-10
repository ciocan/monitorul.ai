import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Section opener for long-form pages (politician profile, document page,
// committee page). Builds the canonical editorial-archival "section masthead"
// pattern from DESIGN.md §4 (tonal layering as primary depth cue):
//   • full-bleed paper-96 band — tonal layer that breaks the page into chapters
//   • 1px paper-91 rule line on top AND bottom of the band — print-archival voice
//   • mono uppercase eyebrow (label register — Roman-numeral chapter affordance)
//   • Source Serif headline (display register — section opener proper)
//   • optional dek beneath, capped at prose width
//   • optional aside slot for inline controls / counts
//
// The band relies on the parent article container being padded (px-6); the
// `-mx-6` here bleeds the band to the article's full width while keeping its
// content aligned with the rest of the page. If you embed SectionOpener in a
// parent with different horizontal padding, pass `bleedClassName` to override.

export interface SectionOpenerProps {
  id: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  dek?: ReactNode;
  aside?: ReactNode;
  className?: string;
  scrollOffset?: boolean;
  bleedClassName?: string;
}

export function SectionOpener({
  id,
  title,
  eyebrow,
  dek,
  aside,
  className,
  scrollOffset = false,
  bleedClassName = "-mx-6 px-6 sm:-mx-8 sm:px-8",
}: SectionOpenerProps) {
  return (
    <header
      className={cn("mb-8 border-y border-paper-91 bg-paper-96 py-7", bleedClassName, className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="label-mono mb-3 text-ink-45">{eyebrow}</p> : null}
          <h2
            id={id}
            className={cn(
              "font-display text-3xl leading-tight text-ink-16 sm:text-[2.25rem]",
              scrollOffset && "scroll-mt-20",
            )}
          >
            {title}
          </h2>
          {dek ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-30">{dek}</p>
          ) : null}
        </div>
        {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
      </div>
    </header>
  );
}
