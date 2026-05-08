import Link from "next/link";

import { SiteNavDesktop, SiteNavMobile } from "@/components/site-nav";
import { SiteSearch } from "@/components/site-search";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) items-center gap-6 px-6 py-4 sm:py-5">
        <Link
          href="/"
          className="font-display relative top-[-4px] text-[18px] leading-none tracking-tight"
        >
          monitorul<span className="text-ink-45">.ai</span>
        </Link>
        <SiteNavDesktop />
        <div className="ml-auto max-w-md flex-1">
          <SiteSearch />
        </div>
        <ThemeToggle />
        <SiteNavMobile />
      </div>
    </header>
  );
}
