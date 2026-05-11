"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { trackFilterApplied, type FilterAppliedProps } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import type { SpeechSize } from "@/lib/format";
import { type CautaSearchParams, activeFilterCount, buildCautaHref } from "@/lib/search-params";

interface ActiveFilterChip {
  label: string;
  href: string;
  // Dimension drives the `filter_applied { action: "removed" }` event fired
  // when the chip is clicked. Multi-year emits one chip per year — they all
  // share dimension "year". `null` for chips that aren't in the tracked v1
  // dimension set (discourse chips below).
  dimension: FilterAppliedProps["dimension"] | null;
}

export interface ActiveFiltersProps {
  params: CautaSearchParams;
  // Resolved labels from sources only the page knows about: speaker name (one
  // network round-trip would be wasted to re-resolve here) and party raw value.
  speakerLabel: string | null;
  partyLabel: string | null;
}

export function ActiveFilters({ params, speakerLabel, partyLabel }: ActiveFiltersProps) {
  if (activeFilterCount(params) === 0) return null;

  const chips: ActiveFilterChip[] = [];

  // Multi-year: one chip per selected year, each removable independently.
  // Sorted ascending so the row reads chronologically.
  if (params.years.length > 0) {
    const sortedYears = [...params.years].sort((a, b) => a - b);
    for (const y of sortedYears) {
      chips.push({
        label: `Anul ${y}`,
        href: buildCautaHref(params, {
          years: params.years.filter((other) => other !== y),
        }),
        dimension: "year",
      });
    }
  } else if (params.dateFrom || params.dateTo) {
    const span =
      params.dateFrom && params.dateTo
        ? `${formatDate(params.dateFrom)} – ${formatDate(params.dateTo)}`
        : params.dateFrom
          ? `de la ${formatDate(params.dateFrom)}`
          : `până la ${formatDate(params.dateTo)}`;
    chips.push({
      label: span,
      href: buildCautaHref(params, { dateFrom: "", dateTo: "" }),
      // Date range maps onto the `year` dimension for analytics purposes —
      // both target the same temporal-filter slot in the user's mental model.
      dimension: "year",
    });
  }

  if (params.chamber) {
    chips.push({
      label: params.chamber,
      href: buildCautaHref(params, { chamber: null }),
      dimension: "chamber",
    });
  }

  if (params.speakerSlug) {
    chips.push({
      label: speakerLabel ?? params.speakerSlug.replace(/-/g, " "),
      href: buildCautaHref(params, { speakerSlug: "" }),
      dimension: "speaker",
    });
  }

  if (params.partySlug) {
    chips.push({
      label: partyLabel ?? params.partySlug.toUpperCase(),
      href: buildCautaHref(params, { partySlug: "" }),
      dimension: "party",
    });
  }

  if (params.includeProcedural) {
    chips.push({
      label: "Include intervenții procedurale",
      href: buildCautaHref(params, { includeProcedural: false }),
      dimension: "procedural",
    });
  }

  const speechSizeLabels: Record<SpeechSize, string> = {
    xs: "Lungime XS",
    s: "Lungime S",
    m: "Lungime M",
    l: "Lungime L",
    xl: "Lungime XL",
  };
  const speechSizeOrder: SpeechSize[] = ["xs", "s", "m", "l", "xl"];
  for (const size of speechSizeOrder.filter((s) => params.speechSizes.includes(s))) {
    chips.push({
      label: speechSizeLabels[size],
      href: buildCautaHref(params, {
        speechSizes: params.speechSizes.filter((other) => other !== size),
      }),
      dimension: "length",
    });
  }

  // Discourse chips fall outside the v1 `FilterAppliedProps["dimension"]`
  // enum — see the `discourse_filter_applied` event for their analogue.
  for (const score of [...params.hawkinsScores].sort((a, b) => a - b)) {
    chips.push({
      label: `H = ${score}`,
      href: buildCautaHref(params, {
        hawkinsScores: params.hawkinsScores.filter((s) => s !== score),
      }),
      dimension: null,
    });
  }
  for (const score of [...params.vpartyScores].sort((a, b) => a - b)) {
    chips.push({
      label: `V = ${score}`,
      href: buildCautaHref(params, {
        vpartyScores: params.vpartyScores.filter((s) => s !== score),
      }),
      dimension: null,
    });
  }
  if (params.dqiLevelMin !== null) {
    chips.push({
      label: `DQI ≥ L${params.dqiLevelMin}`,
      href: buildCautaHref(params, { dqiLevelMin: null }),
      dimension: null,
    });
  }
  if (params.voiceMode === "all") {
    chips.push({
      label: "Toate vocile",
      href: buildCautaHref(params, { voiceMode: "first-person" }),
      dimension: null,
    });
  }
  if (params.confidenceMin !== null) {
    chips.push({
      label: "Doar codări ≥ 0.7",
      href: buildCautaHref(params, { confidenceMin: null }),
      dimension: null,
    });
  }

  return (
    <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtre active">
      <li className="label-mono text-ink-45">Filtre active</li>
      {chips.map((chip) => (
        <li key={chip.href + chip.label}>
          {/* Badge `outline` variant pairs with the panel's paper-96 register
              when the panel is open, and reads cleanly on paper-99 when not.
              `asChild` lets it become a Link without nesting interactive
              elements. */}
          <Badge variant="outline" asChild className="gap-1.5 px-2.5 py-1 text-xs text-ink-30">
            <Link
              href={chip.href}
              onClick={
                chip.dimension
                  ? () =>
                      trackFilterApplied({
                        dimension: chip.dimension as FilterAppliedProps["dimension"],
                        action: "removed",
                      })
                  : undefined
              }
            >
              <span>{chip.label}</span>
              <X className="size-3" aria-hidden />
              <span className="sr-only">Elimină filtrul</span>
            </Link>
          </Badge>
        </li>
      ))}
      <li>
        <Link
          href={buildCautaHref(params, {
            years: [],
            dateFrom: "",
            dateTo: "",
            chamber: null,
            speakerSlug: "",
            partySlug: "",
            speechSizes: [],
            includeProcedural: false,
            hawkinsScores: [],
            vpartyScores: [],
            dqiLevelMin: null,
            voiceMode: "first-person",
            confidenceMin: null,
          })}
          onClick={() =>
            // `dimension: "year"` is the sentinel pick for the reset-all
            // event; the schema requires a dimension but the action is the
            // semantic that matters.
            trackFilterApplied({ dimension: "year", action: "reset_all" })
          }
          className="label-mono text-ink-45 underline decoration-paper-91 underline-offset-4 transition-colors hover:decoration-ink-30 hover:text-ink-30"
        >
          Resetează filtrele
        </Link>
      </li>
    </ul>
  );
}
