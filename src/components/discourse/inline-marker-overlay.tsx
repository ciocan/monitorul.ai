import type { PreparedParagraph } from "@/lib/discourse-markers";
import { voiceHighlightClass } from "@/lib/discourse-markers";
import { cn } from "@/lib/utils";

import { FRAMEWORK_BORDER, FRAMEWORK_FG } from "./framework-badge";

// Renders the speech body paragraph-by-paragraph with marker spans inline.
// Each marked segment is wrapped in a <mark> with voice-encoded styling and
// carries one superscript chip per marker. The client coordination layer
// reads the data attributes here to pair-hover/select the matching side-panel
// card and to draw the large-screen connector.

export interface InlineMarkerOverlayProps {
  paragraphs: PreparedParagraph[];
  className?: string;
}

export function InlineMarkerOverlay({ paragraphs, className }: InlineMarkerOverlayProps) {
  const anchoredMarkerIds = new Set<string>();
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
            const ids = seg.markers.map((m) => m.id).join(" ");
            const isSingleMarker = seg.markers.length === 1;
            return (
              <mark
                key={`${p.absoluteStart}-${segIdx}`}
                data-marker-span=""
                data-marker-ids={ids}
                data-marker-primary-id={lead.id}
                data-marker-framework={lead.framework}
                className={cn(
                  "px-0.5 py-px text-ink-30 transition-colors",
                  voiceHighlightClass(lead.voice),
                )}
              >
                <span
                  data-marker-text=""
                  role={isSingleMarker ? "link" : "button"}
                  tabIndex={0}
                  aria-label={
                    isSingleMarker
                      ? `Selectează marcher ${lead.framework} ${lead.kind}`
                      : `Evidențiază ${seg.markers.length} marcheri pentru acest pasaj`
                  }
                >
                  {seg.text}
                </span>
                {seg.markers.map((m, mIdx) => {
                  const isAnchor = !anchoredMarkerIds.has(m.id);
                  anchoredMarkerIds.add(m.id);
                  return (
                    <a
                      key={m.id}
                      id={isAnchor ? `span-${m.id}` : undefined}
                      href={`#marker-${m.id}`}
                      aria-label={`Marcher ${m.framework} ${m.kind}`}
                      title={`${m.framework}: ${m.kind}`}
                      data-marker-chip=""
                      data-marker-id={m.id}
                      data-marker-framework={m.framework}
                      className={cn(
                        "font-mono-meta ml-px inline-flex h-3 min-w-3 items-center justify-center align-super text-[10px] no-underline",
                        "rounded-none border px-0.5 transition-colors",
                        FRAMEWORK_FG[m.framework],
                        FRAMEWORK_BORDER[m.framework],
                      )}
                    >
                      {seg.markers.length === 1 ? "*" : String(mIdx + 1)}
                    </a>
                  );
                })}
              </mark>
            );
          })}
        </p>
      ))}
    </div>
  );
}
