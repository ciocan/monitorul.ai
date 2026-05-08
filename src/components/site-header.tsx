import Link from "next/link";

import { SiteNavDesktop, SiteNavMobile } from "@/components/site-nav";
import { SiteSearch } from "@/components/site-search";
import { SiteSearchNav } from "@/components/site-search-nav";
import { ThemeToggle } from "@/components/theme-toggle";

// Sticky at the top so the masthead + nav stays reachable on long pages.
// `bg-background` (paper-99) keeps the surface opaque — no glassmorphism /
// backdrop-blur per DESIGN.md "no decorative shadow" rule.
//
// Z-stack:
//   z-30 — this header (sticky, always visible at top by default)
//   z-40 — document-sticky-header (fixed, slides in over this header when
//          the user scrolls past the document opener; replaces the site
//          register with document context for the rest of the read)
//   z-50 — mobile nav full-screen overlay (covers everything when open)
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) items-center gap-6 px-6 py-4 sm:py-5">
        <Link
          href="/"
          className="font-display relative top-[-4px] text-[18px] leading-none tracking-tight"
        >
          monitorul<span className="text-ink-45">.ai</span>
        </Link>
        <SiteNavDesktop />
        <SiteSearchNav>
          <SiteSearch />
        </SiteSearchNav>
        <ThemeToggle />
        <SiteNavMobile />
      </div>
    </header>
  );
}
