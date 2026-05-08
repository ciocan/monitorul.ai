"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DocumentStickyHeaderProps {
  type: string;
  title: string;
  issue: string;
  year: number;
  part: string;
  chamber?: string | null;
  sessionDate?: string | null;
  sentinelId: string;
}

export function DocumentStickyHeader({
  type,
  title,
  issue,
  year,
  part,
  chamber,
  sessionDate,
  sentinelId,
}: DocumentStickyHeaderProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelId]);

  const meta = [
    type,
    chamber ?? null,
    `Partea ${part}`,
    `${issue}/${year}`,
    sessionDate ?? null,
  ].filter((p): p is string => Boolean(p));

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        // z-40 sits above the now-sticky `<SiteHeader>` (z-30) so the
        // document context replaces the site register cleanly when the user
        // has scrolled past the opener. Mobile nav full-screen overlay
        // (z-50) still wins over both.
        "fixed inset-x-0 top-0 z-40 border-b-2 border-paper-91 bg-paper-96 transition-transform duration-200 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <div className="mx-auto flex w-full max-w-(--breakpoint-xl) items-center gap-4 px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="label-mono text-ink-45">
            {meta.map((piece, i) => (
              <span key={`${i}-${piece}`}>
                <span className={i === 0 ? "text-ink-16" : undefined}>{piece}</span>
                {i < meta.length - 1 ? <span className="px-2 text-ink-45">·</span> : null}
              </span>
            ))}
          </p>
          <p className="mt-1 truncate text-sm text-ink-16">{title}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Înapoi sus"
          tabIndex={visible ? 0 : -1}
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            })
          }
          className="shrink-0 bg-paper-99 hover:bg-paper-91"
        >
          <ChevronUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
