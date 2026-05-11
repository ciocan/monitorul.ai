"use client";

import { useEffect } from "react";

import { trackFilterPanelInteraction, type FilterPanelInteractionProps } from "@/lib/analytics";

const CONTROL_ATTR = "data-filter-control";
const ACTION_ATTR = "data-filter-action";

export function FilterPanelAnalytics() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest<HTMLElement>(`[${CONTROL_ATTR}]`);
      if (!el) return;
      if (el.getAttribute("aria-disabled") === "true" || el.hasAttribute("disabled")) return;

      const control = el.getAttribute(CONTROL_ATTR) as FilterPanelInteractionProps["control"];
      const action = el.getAttribute(ACTION_ATTR) as FilterPanelInteractionProps["action"];
      if (!control || !action) return;
      trackFilterPanelInteraction({ control, action });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
