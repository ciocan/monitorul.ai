"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavStatusDot } from "@/components/nav-status-dot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

interface NavLeaf {
  href: string;
  label: string;
  /** Plain Romanian summary shown beneath the label inside desktop dropdowns. */
  hint?: string;
}

type NavEntry =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; label: string; matchHrefs: string[]; items: NavLeaf[] };

// Two top-level shortcuts (Statistici, [MCP]) stay as bare links per the
// site-nav spec; the three core registers fold into "Arhivă", and the two
// methodology notes fold into "Despre". Search / discurs surfaces don't
// appear here — they're entered from the search bar.
const NAV_ENTRIES: NavEntry[] = [
  {
    kind: "group",
    label: "Arhivă",
    matchHrefs: ["/mo", "/politicieni", "/comisii"],
    items: [
      { href: "/mo", label: "Sesiuni", hint: "Stenograme și sinteze, pe an" },
      { href: "/politicieni", label: "Politicieni", hint: "Profile, mandate, top intervenții" },
      { href: "/comisii", label: "Comisii", hint: "Ședințe, prezență, ordine de zi" },
    ],
  },
  { kind: "link", href: "/statistici", label: "Statistici" },
  {
    kind: "group",
    label: "Despre",
    matchHrefs: ["/despre", "/sustine"],
    items: [
      { href: "/despre", label: "Despre arhivă", hint: "Pipeline, identitate, căutare" },
      {
        href: "/despre/discurs",
        label: "Analiza discursului",
        hint: "Patru cadre + voce, metodologie",
      },
      { href: "/sustine", label: "Sprijin", hint: "Costuri, contribuții, rapoarte trimestriale" },
    ],
  },
  // Bracketed mono — the brackets are the affordance. Print-masthead idiom
  // (a service tag set off from the section list typographically, not by
  // colour). Active state behaves like every other item (azure underline)
  // so the bracket framing and the active cue don't compete.
  { kind: "link", href: "/mcp", label: "[MCP]" },
];

interface RepoLink {
  href: string;
  label: string;
  hint: string;
}

const REPOS: RepoLink[] = [
  {
    href: "https://github.com/ciocan/monitorul.ai",
    label: "monitorul.ai",
    hint: "Cod web, UI, server MCP",
  },
  {
    href: "https://github.com/ciocan/monitorul-ii",
    label: "monitorul-ii",
    hint: "Pipeline date — scraper, ingest, embeddings",
  },
];

const ACTIVE_UNDERLINE = { boxShadow: "inset 0 -2px 0 var(--color-azure-3)" } as const;

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAnyCurrent(pathname: string, hrefs: string[]): boolean {
  return hrefs.some((h) => isCurrent(pathname, h));
}

// Tailwind equivalents of `.label-mono` (defined in globals.css). Spelled
// out as utilities so cn/twMerge can dedupe against the navigation-menu
// defaults (`text-xs font-medium`); without this, `text-xs` (12px) wins
// via CSS source order even after we layer `label-mono` later — twMerge
// does not know `label-mono` is in the font-size group.
const LABEL_MONO_TW = "font-mono text-[0.6875rem]/[1.2] font-medium uppercase tracking-[0.16em]";

// Strip the shadcn navigation-menu trigger / link backgrounds, padding,
// gap, and font-size so the editorial label-mono register comes through.
//
// IMPORTANT: pass these via `NavigationMenuTrigger` / `NavigationMenuLink`
// `className` prop (not on the inner asChild Link) — the Radix Slot used
// by asChild simply concatenates className strings without twMerge, so
// defaults like `p-2` would still apply via CSS source order even if our
// `p-0` came later in the string. Going through the wrapper's `className`
// prop runs `cn` which deduplicates correctly.
const NAV_BASE = cn(
  // layout
  "h-auto inline-flex items-center gap-0 whitespace-nowrap p-0",
  // colors — strip muted-bg hover/focus surfaces; only ink color shifts on hover
  "bg-transparent hover:bg-transparent focus:bg-transparent",
  // type — Tailwind equivalents of label-mono so twMerge dedupes vs text-xs
  LABEL_MONO_TW,
  "transition-colors",
);

const TRIGGER_OPEN_RESET = cn(
  "data-popup-open:bg-transparent data-popup-open:hover:bg-transparent",
  "data-open:bg-transparent data-open:hover:bg-transparent data-open:focus:bg-transparent",
  // The shadcn navigation-menu chevron is hardcoded to `relative top-px`,
  // which sits its center on the box's geometric middle — too low for the
  // pb-1 underline-padded label-mono register. Lift it 4px so the chevron
  // tip lands ~1px above the text middle. `[&>svg]` outranks the chevron's
  // own single-class `top-px` via descendant-selector specificity.
  "[&>svg]:top-[-2px]",
);

export function SiteNavDesktop() {
  const pathname = usePathname() ?? "/";
  return (
    <NavigationMenu aria-label="Navigare principală" viewport={false} className="hidden md:flex">
      <NavigationMenuList className="gap-5">
        {NAV_ENTRIES.map((entry) => {
          if (entry.kind === "link") {
            const active = isCurrent(pathname, entry.href);
            return (
              <NavigationMenuItem key={entry.href}>
                <NavigationMenuLink
                  asChild
                  className={cn(NAV_BASE, active ? "text-ink-16" : "text-ink-30 hover:text-ink-16")}
                >
                  <Link href={entry.href} aria-current={active ? "page" : undefined}>
                    <span className="pb-1" style={active ? ACTIVE_UNDERLINE : undefined}>
                      {entry.label}
                    </span>
                    <NavStatusDot />
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          }
          const active = isAnyCurrent(pathname, entry.matchHrefs);
          return (
            <NavigationMenuItem key={entry.label}>
              <NavigationMenuTrigger
                className={cn(
                  NAV_BASE,
                  TRIGGER_OPEN_RESET,
                  active ? "text-ink-16" : "text-ink-30 hover:text-ink-16",
                )}
              >
                <span className="pb-1" style={active ? ACTIVE_UNDERLINE : undefined}>
                  {entry.label}
                </span>
              </NavigationMenuTrigger>
              <NavigationMenuContent className="z-50 min-w-[280px] p-0">
                <ul className="flex flex-col">
                  {entry.items.map((item) => {
                    const itemActive = isCurrent(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <NavigationMenuLink
                          asChild
                          className={cn(
                            "flex flex-col items-start gap-1 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-paper-96 focus:bg-paper-96",
                            itemActive && "bg-paper-96",
                          )}
                        >
                          <Link href={item.href} aria-current={itemActive ? "page" : undefined}>
                            <span
                              className={cn(
                                "label-mono",
                                itemActive ? "text-ink-16" : "text-ink-30",
                              )}
                            >
                              {item.label}
                            </span>
                            {item.hint ? (
                              <span className="text-xs text-ink-45">{item.hint}</span>
                            ) : null}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

// GitHub mark — lucide-react@1.x ships no brand icons, so the octocat mark
// is inlined. Path data is GitHub's own published mark (Logos / fluentui).
function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

// GitHub-repos dropdown for the masthead. Two repos: the website (this
// repo) and the data pipeline (monitorul-ii). Mobile gets a separate
// section inside the open mobile-nav panel — see `SiteNavMobile`.
export function SiteRepoMenu({ className }: { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cod sursă pe GitHub"
          title="Cod sursă pe GitHub"
          className={cn("text-ink-30 hover:text-ink-16", className)}
        >
          <GithubMark className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
        <DropdownMenuLabel className="label-mono text-ink-45">Cod sursă</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REPOS.map((repo) => (
          <DropdownMenuItem key={repo.href} asChild>
            <a
              href={repo.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-start gap-1"
            >
              <span className="label-mono text-ink-30">{repo.label}</span>
              <span className="text-xs text-ink-45">{repo.hint}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavLeaf;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isCurrent(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "label-mono inline-flex items-baseline whitespace-nowrap text-[1.125rem] transition-colors",
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

  const close = () => setOpen(false);

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
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper-99 md:hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <span className="font-display text-[18px] leading-none tracking-tight">
              monitorul<span className="text-ink-45">.ai</span>
            </span>
            <button
              type="button"
              aria-label="Închide meniul"
              onClick={close}
              className="label-mono text-ink-30 transition-colors hover:text-ink-16"
            >
              Închide
            </button>
          </div>
          <nav aria-label="Navigare principală" className="flex flex-col gap-7 px-6 py-8">
            {NAV_ENTRIES.map((entry) => {
              if (entry.kind === "link") {
                return (
                  <MobileLink
                    key={entry.href}
                    item={{ href: entry.href, label: entry.label }}
                    pathname={pathname}
                    onNavigate={close}
                  />
                );
              }
              return (
                <section key={entry.label} className="flex flex-col gap-4">
                  <p className="label-mono text-ink-45">{entry.label}</p>
                  <div className="flex flex-col gap-4 pl-3">
                    {entry.items.map((item) => (
                      <MobileLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onNavigate={close}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
            <section className="flex flex-col gap-4">
              <p className="label-mono text-ink-45">Cod sursă</p>
              <div className="flex flex-col gap-4 pl-3">
                {REPOS.map((repo) => (
                  <a
                    key={repo.href}
                    href={repo.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                    className="label-mono inline-flex items-baseline whitespace-nowrap text-[1.125rem] text-ink-30 transition-colors hover:text-ink-16"
                  >
                    {repo.label}
                  </a>
                ))}
              </div>
            </section>
          </nav>
          {accountSlot ? <div className="mt-auto">{accountSlot}</div> : null}
        </div>
      ) : null}
    </>
  );
}
