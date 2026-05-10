import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  DQI_CONSTRUCTIVE_LABEL,
  DQI_CONTENT_LABEL,
  DQI_LEVEL_LABEL,
  hvScoreLabel,
  voiceLabel,
} from "@/lib/discourse-copy";
import type { DiscourseEnrichment } from "@/lib/types";

import { ConfidenceDot } from "./confidence-dot";

// Compact header strip rendered above the speech body when discourse data
// exists. Per Q1 of the grill: rate-framed and per-speech only — never
// implies anything about the speaker's traits. The four frameworks each get
// a one-line slot; absent codings render "—".

export interface SpeechDiscourseSummaryProps {
  discourse: DiscourseEnrichment;
  producerLabel?: string | null;
  className?: string;
}

export function SpeechDiscourseSummary({
  discourse,
  producerLabel,
  className,
}: SpeechDiscourseSummaryProps) {
  const h = discourse.hawkins;
  const v = discourse.vparty;
  const d = discourse.dqi;
  const voice = discourse.voice;
  return (
    <div className={cn("border border-paper-91 bg-paper-96/40 px-4 py-3 text-sm", className)}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <Row
          label="Populism"
          framework="hawkins"
          value={typeof h?.score === "number" ? `${h.score} · ${hvScoreLabel(h.score)}` : "—"}
          confidence={h?.framework_confidence ?? null}
          markerCount={h?.marker_count}
        />
        <Row
          label="Anti-pluralism"
          framework="vparty"
          value={typeof v?.score === "number" ? `${v.score} · ${hvScoreLabel(v.score)}` : "—"}
          confidence={v?.framework_confidence ?? null}
          markerCount={v?.marker_count}
        />
        <Row
          label="DQI"
          framework="dqi"
          value={
            d
              ? `nivel ${d.level_of_justification} · ${DQI_LEVEL_LABEL[d.level_of_justification]}`
              : "—"
          }
          confidence={d?.framework_confidence ?? null}
          extra={
            d
              ? `${DQI_CONTENT_LABEL[d.content_of_justification] ?? d.content_of_justification} · ${DQI_CONSTRUCTIVE_LABEL[d.constructive_politics] ?? d.constructive_politics}`
              : null
          }
        />
        <Row
          label="Voce"
          framework="voice"
          value={voice ? voiceLabel(voice.dominant_voice) : "—"}
          confidence={null}
          extra={
            voice && voice.voices_seen.length > 1
              ? `+${voice.voices_seen.length - 1} alte voci`
              : null
          }
        />
      </dl>
      {producerLabel ? (
        <p className="font-mono-meta mt-3 border-t border-paper-91 pt-2 text-[11px] text-ink-45">
          Codat de {producerLabel}.{" "}
          <Link
            href="/despre#discurs-analiza"
            className="underline decoration-paper-91 underline-offset-2 hover:text-ink-30 hover:decoration-ink-30"
          >
            Metodologie
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  framework,
  value,
  confidence,
  extra,
  markerCount,
}: {
  label: string;
  framework: "hawkins" | "vparty" | "dqi" | "voice";
  value: string;
  confidence: number | null;
  extra?: string | null;
  markerCount?: number | null;
}) {
  const fgClass =
    framework === "dqi"
      ? "text-azure-3"
      : framework === "voice"
        ? "text-ink-30"
        : "text-alert-civic";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={cn("label-mono", fgClass)}>{label}</dt>
      <dd className="flex items-center gap-2 text-ink-30">
        <span>{value}</span>
        <ConfidenceDot confidence={confidence} />
        {typeof markerCount === "number" && markerCount > 0 ? (
          <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
            {markerCount} marcheri
          </span>
        ) : null}
      </dd>
      {extra ? <span className="text-xs text-ink-45">{extra}</span> : null}
    </div>
  );
}
