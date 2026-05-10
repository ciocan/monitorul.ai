"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavStatusDot } from "@/components/nav-status-dot";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/mo", label: "Sesiuni" },
  { href: "/politicieni", label: "Politicieni" },
  { href: "/comisii", label: "Comisii" },
  { href: "/statistici", label: "Statistici" },
  { href: "/despre", label: "Despre" },
  // Bracketed mono — the brackets are the affordance. Print-masthead idiom
  // (a service tag set off from the section list typographically, not by
  // colour). Active state behaves like every other item (azure underline)
  // so the bracket framing and the active cue don't compete.
  { href: "/mcp", label: "[MCP]" },
];

const ACTIVE_UNDERLINE = { boxShadow: "inset 0 -2px 0 var(--color-azure-3)" } as const;

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  size = "sm",
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  size?: "sm" | "lg";
  onNavigate?: () => void;
}) {
  const active = isCurrent(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "label-mono inline-flex items-baseline whitespace-nowrap transition-colors",
        size === "lg" && "text-[1.125rem]",
        active ? "text-ink-16" : "text-ink-30 hover:text-ink-16",
      )}
    >
      <span className="pb-1" style={active ? ACTIVE_UNDERLINE : undefined}>
        {item.label}
      </span>
      <NavStatusDot />
    </Link>
  );
}

export function SiteNavDesktop() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Navigare principală" className="hidden items-center gap-5 md:flex">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

// `accountSlot` is rendered inside the open mobile-nav dialog, after the
// section list. The parent (a server component) injects `<AccountMobileSection />`
// there so the session lookup happens server-side, while this component
// stays client-side for the open/close state.
export function SiteNavMobile({ accountSlot }: { accountSlot?: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        aria-label={open ? "Închide meniul" : "Deschide meniul"}
        onClick={() => setOpen((s) => !s)}
        className="label-mono text-ink-30 transition-colors hover:text-ink-16 md:hidden"
      >
        Meniu
      </button>

      {open ? (
        <div
          id="site-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigare"
          className="fixed inset-0 z-50 flex flex-col bg-paper-99 md:hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <span className="font-display text-[18px] leading-none tracking-tight">
              monitorul<span className="text-ink-45">.ai</span>
            </span>
            <button
              type="button"
              aria-label="Închide meniul"
              onClick={() => setOpen(false)}
              className="label-mono text-ink-30 transition-colors hover:text-ink-16"
            >
              Închide
            </button>
          </div>
          <nav aria-label="Navigare principală" className="flex flex-col gap-6 px-6 py-8">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                size="lg"
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
          {accountSlot ? <div className="mt-auto">{accountSlot}</div> : null}
        </div>
      ) : null}
    </>
  );
}
