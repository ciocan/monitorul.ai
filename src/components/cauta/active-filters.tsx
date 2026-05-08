import Link from "next/link";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { type CautaSearchParams, activeFilterCount, buildCautaHref } from "@/lib/search-params";

interface ActiveFilterChip {
  label: string;
  href: string;
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
    });
  }

  if (params.chamber) {
    chips.push({
      label: params.chamber,
      href: buildCautaHref(params, { chamber: null }),
    });
  }

  if (params.speakerSlug) {
    chips.push({
      label: speakerLabel ?? params.speakerSlug.replace(/-/g, " "),
      href: buildCautaHref(params, { speakerSlug: "" }),
    });
  }

  if (params.partySlug) {
    chips.push({
      label: partyLabel ?? params.partySlug.toUpperCase(),
      href: buildCautaHref(params, { partySlug: "" }),
    });
  }

  if (params.includeProcedural) {
    chips.push({
      label: "Include intervenții procedurale",
      href: buildCautaHref(params, { includeProcedural: false }),
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
            <Link href={chip.href}>
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
            includeProcedural: false,
          })}
          className="label-mono text-ink-45 underline decoration-paper-91 underline-offset-4 transition-colors hover:decoration-ink-30 hover:text-ink-30"
        >
          Resetează filtrele
        </Link>
      </li>
    </ul>
  );
}
