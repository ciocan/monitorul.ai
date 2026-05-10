import type { PreparedParagraph } from "@/lib/discourse-markers";
import { voiceHighlightClass } from "@/lib/discourse-markers";
import { cn } from "@/lib/utils";

import { FRAMEWORK_BORDER, FRAMEWORK_FG } from "./framework-badge";

// Renders the speech body paragraph-by-paragraph with marker spans inline.
// Each marked segment is wrapped in a <mark> with voice-encoded styling and
// carries an `<a>` superscript chip in the inline flow that points at the
// matching side-panel card. (Margin chips on a desktop sidebar are noted as
// future-work; for the v1 layout the inline superscript chips read cleanly
// in the existing prose column without needing a second margin.)
//
// Click flow: a marker span's chip uses an in-page `#marker-<id>` anchor.
// The side panel cards carry `id="marker-<id>"` and the body spans carry
// `id="span-<id>"`. The shared scroll-flash module drops a `data-flash`
// attribute on the target which CSS animates briefly. Same flow runs in
// reverse from the side panel's "În context" link.

export interface InlineMarkerOverlayProps {
  paragraphs: PreparedParagraph[];
  className?: string;
}

export function InlineMarkerOverlay({ paragraphs, className }: InlineMarkerOverlayProps) {
  return (
    <div className={cn("max-w-prose space-y-4 text-base leading-relaxed text-ink-30", className)}>
      {paragraphs.map((p, idx) => (
        <p key={`${p.absoluteStart}-${idx}`}>
          {p.segments.map((seg, segIdx) => {
            if (seg.markers.length === 0) {
              return <span key={`${p.absoluteStart}-${segIdx}`}>{seg.text}</span>;
            }
            // First marker dictates the voice tone (markers covering the same
            // segment ought to agree on voice in v0.1; if not, we honor the
            // earliest one).
            const lead = seg.markers[0];
            return (
              <mark
                key={`${p.absoluteStart}-${segIdx}`}
                id={`span-${lead.id}`}
                data-marker-id={lead.id}
                className={cn(
                  "px-0.5 py-px text-ink-30 transition-colors",
                  voiceHighlightClass(lead.voice),
                  "data-[flash=true]:bg-azure-3/30 data-[flash=true]:transition-none",
                )}
              >
                <span>{seg.text}</span>
                {seg.markers.map((m, mIdx) => (
                  <a
                    key={m.id}
                    href={`#marker-${m.id}`}
                    aria-label={`Marcher ${m.framework} ${m.kind}`}
                    title={`${m.framework}: ${m.kind}`}
                    className={cn(
                      "font-mono-meta ml-px inline-flex h-3 min-w-3 items-center justify-center align-super text-[10px] no-underline",
                      "rounded-none border px-0.5",
                      FRAMEWORK_FG[m.framework],
                      FRAMEWORK_BORDER[m.framework],
                    )}
                  >
                    {seg.markers.length === 1 ? "*" : String(mIdx + 1)}
                  </a>
                ))}
              </mark>
            );
          })}
        </p>
      ))}
    </div>
  );
}
