"use client";

import { useEffect, useState } from "react";

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
        "fixed inset-x-0 top-0 z-30 border-b border-border bg-paper-99/92 backdrop-blur supports-[backdrop-filter]:bg-paper-99/80 transition-transform duration-200 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <div className="mx-auto flex w-full max-w-(--breakpoint-xl) items-baseline gap-6 px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="label-mono text-ink-45">
            {meta.map((piece, i) => (
              <span key={`${i}-${piece}`}>
                <span className={i === 0 ? "text-ink-30" : undefined}>{piece}</span>
                {i < meta.length - 1 ? <span className="px-2 text-ink-45">·</span> : null}
              </span>
            ))}
          </p>
          <p className="mt-1 truncate text-sm text-ink-16">{title}</p>
        </div>
      </div>
    </div>
  );
}
