"use client";

import { useRouter } from "next/navigation";

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

        for (const [k, v] of fd.entries()) {
          if (typeof v !== "string") continue;
          const trimmed = v.trim();
          if (!trimmed) continue;
          // Default sort doesn't need to ride in the URL.
          if (k === "sort" && trimmed === "relevance") continue;
          sp.set(k, trimmed);
        }
        const qs = sp.toString();
        router.push(qs ? `/cauta?${qs}` : "/cauta");
      }}
    >
      {children}
    </form>
  );
}
