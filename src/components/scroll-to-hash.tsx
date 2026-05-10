"use client";

import { useEffect } from "react";

// Re-applies hash scrolling once the page has hydrated. The browser scrolls
// to a hash exactly once, when the URL changes; if a `loading.tsx` Suspense
// fallback is showing at that moment the anchor element does not yet exist
// and the scroll is silently dropped. Without this component, deep links
// like `/mo/.../...#discurs-42` (used by /cauta hits) land at the top of
// the document instead of on the cited speech.
export function ScrollToHash() {
  useEffect(() => {
    const { hash } = window.location;
    if (hash.length < 2) return;
    const id = decodeURIComponent(hash.slice(1));
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "start" });
    });
  }, []);
  return null;
}
