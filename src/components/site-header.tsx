import Link from "next/link";

import { SiteSearch } from "@/components/site-search";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) items-center gap-6 px-6 py-4 sm:py-5">
        <Link href="/" className="font-display text-[18px] leading-none tracking-tight">
          monitorul<span className="text-ink-45">.ai</span>
        </Link>
        <nav aria-label="Navigare principală" className="hidden md:flex items-center gap-5">
          <HeaderLink href="/mo">Sesiuni</HeaderLink>
          <HeaderLink href="/politicieni">Politicieni</HeaderLink>
          <HeaderLink href="/comisii">Comisii</HeaderLink>
          <HeaderLink href="/despre">Despre</HeaderLink>
        </nav>
        <div className="ml-auto flex-1 max-w-md">
          <SiteSearch />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="label-mono text-ink-30 transition-colors hover:text-ink-16">
      {children}
    </Link>
  );
}
