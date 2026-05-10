"use client";

import { useEffect } from "react";

import {
  trackSearchPerformed,
  trackSearchResultClicked,
  type SearchPerformedProps,
  type SearchResultClickedProps,
} from "@/lib/analytics";

// Wraps the search-results section. Fires `search_performed` once on mount
// with the static search metadata the server already computed; delegates
// click events on anchor descendants with `data-result-position` to fire
// `search_result_clicked`. Putting one delegating handler on the wrapper
// keeps the per-hit JSX server-rendered (no per-row client component) and
// avoids an extra useEffect per result row.
export function SearchTracker({
  performed,
  resultMeta,
  children,
}: {
  performed: SearchPerformedProps;
  // Static-per-page metadata used to enrich the per-row click events. The
  // page-level `mode` is the same for every row; `page` likewise. We could
  // read these off data-attrs too but threading them in keeps the per-row
  // JSX minimal.
  resultMeta: Pick<SearchResultClickedProps, "page" | "mode">;
  children: React.ReactNode;
}) {
  // The metadata is stable across the page render — fire once per /cauta
  // render. Soft-nav with new params replays this whole component fresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => trackSearchPerformed(performed), []);

  return (
    <div
      onClick={(e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        // Any anchor click inside a result row counts as a row click. The
        // data lives on the row's <li> so each hit row only has to encode
        // the metadata once.
        if (!target.closest("a")) return;
        const row = target.closest("[data-result-position]");
        if (!(row instanceof HTMLElement)) return;
        const position = Number(row.dataset.resultPosition);
        const kind = row.dataset.resultKind as SearchResultClickedProps["result_kind"];
        const hasSpeaker = row.dataset.resultHasSpeaker === "1";
        const hasDiscourse = row.dataset.resultHasDiscourse === "1";
        if (!Number.isInteger(position) || !kind) return;
        trackSearchResultClicked({
          position,
          page: resultMeta.page,
          result_kind: kind,
          has_speaker: hasSpeaker,
          has_discourse: hasDiscourse,
          mode: resultMeta.mode,
        });
      }}
    >
      {children}
    </div>
  );
}
