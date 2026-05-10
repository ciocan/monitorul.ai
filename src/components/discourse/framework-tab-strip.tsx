import Link from "next/link";

import { cn } from "@/lib/utils";

import { FRAMEWORK_LABEL } from "@/lib/discourse-copy";
import type { DiscourseFramework } from "@/lib/types";

import { FRAMEWORK_FG } from "./framework-badge";

// One framework tab per Hawkins / V-Party / DQI / Voce. Each tab is a `<Link>`
// that swaps the `?fw=` URL param while preserving every other chip toggle
// (?voice, ?conf, ?year). Server-rendered, no client JS, history-stable.

const FRAMEWORK_ORDER: DiscourseFramework[] = ["hawkins", "vparty", "dqi", "voice"];

export interface FrameworkTabStripProps {
  basePath: string;
  searchParams: URLSearchParams;
  current: DiscourseFramework;
  className?: string;
}

export function FrameworkTabStrip({
  basePath,
  searchParams,
  current,
  className,
}: FrameworkTabStripProps) {
  return (
    <nav
      className={cn(
        "flex flex-wrap items-baseline gap-px border-b border-paper-91 text-sm",
        className,
      )}
      aria-label="Framework analiza discursului"
    >
      {FRAMEWORK_ORDER.map((fw) => {
        const sp = new URLSearchParams(searchParams);
        if (fw === FRAMEWORK_ORDER[0]) sp.delete("fw");
        else sp.set("fw", fw);
        const qs = sp.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;
        const active = current === fw;
        return (
          <Link
            key={fw}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2 transition-colors",
              active
                ? cn("border-b-2 border-current", FRAMEWORK_FG[fw])
                : "border-b-2 border-transparent text-ink-45 hover:text-ink-30",
            )}
          >
            {FRAMEWORK_LABEL[fw]}
          </Link>
        );
      })}
    </nav>
  );
}

export const FRAMEWORK_TAB_ORDER = FRAMEWORK_ORDER;
