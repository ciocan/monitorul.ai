import type { MarkerView } from "@/lib/discourse-markers";
import { markerKindLabel, voiceLabel } from "@/lib/discourse-copy";
import { cn } from "@/lib/utils";

import { ConfidenceDot } from "./confidence-dot";
import { FrameworkBadge } from "./framework-badge";

// One side-panel card per marker. Carries the framework + kind chip, voice
// + confidence summary, the LLM-generated short rationale, and the verbatim
// evidence excerpt. Click the "În context" link → flash the matching span
// in the body via the shared `?flash` URL routing handled by `<ScrollFlash>`.

export interface MarkerCardProps {
  marker: MarkerView;
  className?: string;
}

export function MarkerCard({ marker, className }: MarkerCardProps) {
  return (
    <article
      id={`marker-${marker.id}`}
      data-marker-id={marker.id}
      className={cn(
        "relative space-y-2 border border-paper-91 bg-paper-99 p-3",
        "scroll-mt-32",
        "data-[flash=true]:border-azure-3 data-[flash=true]:transition-none",
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
        <a
          href={`#span-${marker.id}`}
          className="label-mono text-ink-45 underline decoration-paper-91 underline-offset-4 hover:text-ink-30 hover:decoration-ink-30"
        >
          În context ↑
        </a>
      </p>
    </article>
  );
}
