import Link from "next/link";

import { cn } from "@/lib/utils";

// Shared paginator for list pages (`/cauta`, `/politicieni/[slug]`). Each
// caller passes a `pageHref` builder so it can preserve its own search params
// (`q` for search, `year` / `day` for the person profile, etc.).

export interface PaginationProps {
  page: number;
  totalPages: number;
  pageHref: (page: number) => string;
  className?: string;
}

export function Pagination({ page, totalPages, pageHref, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const prevHref = page > 1 ? pageHref(page - 1) : null;
  const nextHref = page < totalPages ? pageHref(page + 1) : null;
  return (
    <nav
      aria-label="Paginare"
      className={cn(
        "mt-8 flex items-center justify-between gap-4 border-t border-border pt-6",
        className,
      )}
    >
      <PaginationLink href={prevHref}>← Pagina anterioară</PaginationLink>
      <p className="label-mono text-ink-45" data-tabular-nums="">
        Pagina {page} din {totalPages}
      </p>
      <PaginationLink href={nextHref} alignEnd>
        Pagina următoare →
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  href,
  alignEnd,
  children,
}: {
  href: string | null;
  alignEnd?: boolean;
  children: React.ReactNode;
}) {
  const baseClass = cn(
    "label-mono transition-colors",
    alignEnd ? "ml-auto" : null,
    href ? "text-ink-30 hover:text-ink-16" : "cursor-not-allowed text-ink-45",
  );
  if (!href) {
    return (
      <span className={baseClass} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={baseClass}>
      {children}
    </Link>
  );
}
