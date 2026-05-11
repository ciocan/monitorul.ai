"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { trackFilterApplied, type FilterAppliedProps } from "@/lib/analytics";

// Pure form + Aplică button. The wrapper exists so that:
//   - Empty inputs (e.g. `chamber=` when "Toate" is selected) are stripped
//     before the URL is built — keeps share-links terse.
//   - Submission goes through `router.push` for soft navigation when JS is
//     available; falls back to a plain GET submission otherwise.
//
// The form itself is server-rendered and works without JS — this wrapper just
// upgrades the experience.
export function CautaFilterForm({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentParams = useSearchParams();
  return (
    <form
      action="/cauta"
      method="GET"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);

        // Multi-year: collect every `name="year"` value (chip checkboxes +
        // older-picker hidden inputs) into one comma-joined `?year=` param.
        // Sorted ascending for stable share-links. Empty list = no `?year=`.
        const yearSet = new Set<string>();
        for (const v of fd.getAll("year")) {
          const s = String(v).trim();
          if (s) yearSet.add(s);
        }
        fd.delete("year");
        const years = [...yearSet]
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isInteger(n))
          .sort((a, b) => a - b);

        const sp = new URLSearchParams();
        if (years.length > 0) sp.set("year", years.join(","));

        // Multi-select Hawkins / V-Party score chips — same shape as year.
        for (const key of ["hawkins", "vparty"]) {
          const set = new Set<string>();
          for (const v of fd.getAll(key)) {
            const s = String(v).trim();
            if (s) set.add(s);
          }
          fd.delete(key);
          if (set.size > 0) {
            const csv = [...set]
              .map((s) => Number.parseInt(s, 10))
              .filter((n) => n === 0 || n === 1 || n === 2)
              .sort((a, b) => a - b)
              .join(",");
            if (csv) sp.set(key, csv);
          }
        }

        const lengthOrder = ["xs", "s", "m", "l", "xl"];
        const lengthSet = new Set<string>();
        for (const v of fd.getAll("length")) {
          const s = String(v).trim().toLowerCase();
          if (lengthOrder.includes(s)) lengthSet.add(s);
        }
        fd.delete("length");
        if (lengthSet.size > 0) {
          sp.set("length", lengthOrder.filter((size) => lengthSet.has(size)).join(","));
        }

        for (const [k, v] of fd.entries()) {
          if (typeof v !== "string") continue;
          const trimmed = v.trim();
          if (!trimmed) continue;
          // Default sort doesn't need to ride in the URL.
          if (k === "sort" && trimmed === "relevance") continue;
          // Voice "first-person" (the implicit default) → omit.
          if (k === "voice" && trimmed === "first-person") continue;
          sp.set(k, trimmed);
        }

        // Diff against current URL state — fire one `filter_applied` event
        // per dimension whose presence changed. Multi-year / multi-score
        // filters fire one event per dimension (not per chip), since the
        // form Aplică is a single batch action.
        emitFilterDiff(currentParams, sp);

        const qs = sp.toString();
        router.push(qs ? `/cauta?${qs}` : "/cauta");
      }}
    >
      {children}
    </form>
  );
}

const TRACKED_DIMENSIONS: Array<{
  dimension: FilterAppliedProps["dimension"];
  param: string;
}> = [
  { dimension: "year", param: "year" },
  { dimension: "chamber", param: "chamber" },
  { dimension: "speaker", param: "speaker" },
  { dimension: "party", param: "party" },
  { dimension: "length", param: "length" },
  { dimension: "procedural", param: "procedural" },
  { dimension: "sort", param: "sort" },
];

function emitFilterDiff(prev: URLSearchParams | null, next: URLSearchParams): void {
  for (const { dimension, param } of TRACKED_DIMENSIONS) {
    const had = Boolean(prev?.get(param));
    const has = Boolean(next.get(param));
    if (had === has) continue;
    trackFilterApplied({ dimension, action: has ? "added" : "removed" });
  }
}
