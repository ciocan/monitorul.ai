import type { MarkerView } from "@/lib/discourse-markers";
import { markerKindLabel, voiceLabel } from "@/lib/discourse-copy";
import { cn } from "@/lib/utils";

import { ConfidenceDot } from "./confidence-dot";
import { FrameworkBadge } from "./framework-badge";

// One side-panel card per marker. Carries the framework + kind chip, voice
// + confidence summary, the LLM-generated short rationale, and the verbatim
// evidence excerpt. The data attributes are consumed by the client
// coordination layer that pairs cards with inline evidence spans.

export interface MarkerCardProps {
  marker: MarkerView;
  className?: string;
}

export function MarkerCard({ marker, className }: MarkerCardProps) {
  return (
    <a
      id={`marker-${marker.id}`}
      href={`#span-${marker.id}`}
      data-marker-card=""
      data-marker-id={marker.id}
      data-marker-framework={marker.framework}
      aria-label={`Marcher ${marker.framework} ${marker.kind}: vezi în context`}
      className={cn(
        "relative block space-y-2 border border-paper-91 bg-paper-99 p-3 no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        "scroll-mt-32",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline gap-2">
        <FrameworkBadge framework={marker.framework} />
        <span className="text-sm text-ink-30">
          {markerKindLabel(marker.framework, marker.kind)}
          {marker.dqiValue ? (
            <span className="ml-1 font-mono-meta text-xs text-ink-45">· {marker.dqiValue}</span>
          ) : null}
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-45">
        <span className="inline-flex items-center gap-1">
          <span className="label-mono">Voce</span>
          <span>{voiceLabel(marker.voice)}</span>
          <ConfidenceDot confidence={marker.voiceConfidence} />
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="label-mono">Marker</span>
          <ConfidenceDot confidence={marker.markerConfidence} />
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="label-mono">Cadru</span>
          <ConfidenceDot confidence={marker.frameworkConfidence} />
        </span>
      </div>
      {marker.rationaleShort ? (
        <p className="text-sm leading-relaxed text-ink-30">{marker.rationaleShort}</p>
      ) : null}
      {marker.evidence.text ? (
        <blockquote className="border-l-2 border-paper-91 pl-3 font-display text-sm italic text-ink-30">
          „{marker.evidence.text}”
        </blockquote>
      ) : null}
      {marker.attributedTo ? (
        <p className="text-xs text-ink-45">
          <span className="label-mono mr-1">Atribuit</span>
          {marker.attributedTo}
        </p>
      ) : null}
      <p>
        <span
          data-marker-context-link=""
          data-marker-id={marker.id}
          data-marker-framework={marker.framework}
          className="label-mono text-ink-45 underline decoration-paper-91 underline-offset-4 hover:text-ink-30 hover:decoration-ink-30"
        >
          În context ↑
        </span>
      </p>
    </a>
  );
}
