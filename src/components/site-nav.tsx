"use client";

import { CalendarDays, Info, Landmark, type LucideIcon, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/mo", label: "Sesiuni", Icon: CalendarDays },
  { href: "/politicieni", label: "Politicieni", Icon: Users },
  { href: "/comisii", label: "Comisii", Icon: Landmark },
  { href: "/despre", label: "Despre", Icon: Info },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "label-mono relative inline-flex items-center gap-1.5 whitespace-nowrap transition-colors",
        active
          ? "text-ink-16 after:absolute after:inset-x-0 after:-bottom-2 after:h-px after:bg-ink-30"
          : "text-ink-30 hover:text-ink-16",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {item.label}
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

export function SiteNavMobile() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Navigare principală" className="border-t border-border bg-paper-99 md:hidden">
      <ul className="mx-auto flex w-full max-w-(--breakpoint-2xl) items-center gap-5 overflow-x-auto px-6 py-3">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
