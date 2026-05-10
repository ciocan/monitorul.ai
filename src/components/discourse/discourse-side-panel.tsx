import { cn } from "@/lib/utils";

import type { DiscourseUiParams } from "@/lib/discourse-params";
import type { MarkerView } from "@/lib/discourse-markers";
import type { DiscourseFramework } from "@/lib/types";

import { ConfidenceToggle } from "./confidence-toggle";
import { FrameworkBadge } from "./framework-badge";
import { MarkerCard } from "./marker-card";
import { VoiceToggle } from "./voice-toggle";

// Right-rail panel grouping marker cards by framework. On wide viewports
// (`lg:` breakpoint and up) renders as a sidebar `<aside>` next to the
// speech body; on narrower screens collapses below the body in document
// flow with the same content. Mobile drawer variant is not added in v1 —
// stacking below the body keeps the page navigable on phones, and the
// scroll-flash anchor coordination still works.

const FRAMEWORK_ORDER: DiscourseFramework[] = ["hawkins", "vparty", "dqi"];

export interface DiscourseSidePanelProps {
  markers: MarkerView[];
  totalMarkers: number;
  basePath: string;
  searchParams: URLSearchParams;
  params: DiscourseUiParams;
  className?: string;
}

export function DiscourseSidePanel({
  markers,
  totalMarkers,
  basePath,
  searchParams,
  params,
  className,
}: DiscourseSidePanelProps) {
  // Group markers by framework while preserving original order within each
  // group (which mirrors the producer's emission order — earliest evidence
  // first when the producer respected it).
  const grouped = new Map<DiscourseFramework, MarkerView[]>();
  for (const m of markers) {
    const list = grouped.get(m.framework) ?? [];
    list.push(m);
    grouped.set(m.framework, list);
  }
  const visibleCount = markers.length;
  const filteredOut = totalMarkers - visibleCount;
  return (
    <aside
      className={cn("border border-paper-91 bg-paper-96/40 p-4", "lg:sticky lg:top-24", className)}
      aria-labelledby="discourse-panel-title"
    >
      <header className="mb-3 space-y-2">
        <h2 id="discourse-panel-title" className="label-mono text-ink-30">
          Marcheri ({visibleCount}
          {filteredOut > 0 ? <span className="text-ink-45"> din {totalMarkers}</span> : null})
        </h2>
        <div className="flex flex-wrap gap-2">
          <VoiceToggle
            basePath={basePath}
            searchParams={searchParams}
            voiceMode={params.voiceMode}
          />
          <ConfidenceToggle
            basePath={basePath}
            searchParams={searchParams}
            confidenceMin={params.confidenceMin}
          />
        </div>
      </header>
      {visibleCount === 0 ? (
        <p className="text-sm leading-relaxed text-ink-45">
          {totalMarkers === 0
            ? "Acest discurs nu a generat marcheri în niciuna dintre cele 4 framework-uri analizate."
            : "Filtrele active ascund toți marcherii. Ajustează vocea sau încrederea pentru a-i vedea."}
        </p>
      ) : (
        <div className="space-y-5">
          {FRAMEWORK_ORDER.map((fw) => {
            const list = grouped.get(fw);
            if (!list || list.length === 0) return null;
            return (
              <section key={fw} className="space-y-2">
                <FrameworkBadge framework={fw} long />
                <div className="space-y-2">
                  {list.map((m) => (
                    <MarkerCard key={m.id} marker={m} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
