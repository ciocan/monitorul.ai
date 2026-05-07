import { cn } from "@/lib/utils";

export interface DatelineProps {
  parts: Array<string | null | undefined>;
  className?: string;
}

// Signature component (DESIGN.md §5): a short mono uppercase strip at the
// top of every record-bearing page. Wraps with the same separator on narrow
// viewports; never broken across two lines on ≥640px.
export function Dateline({ parts, className }: DatelineProps) {
  const visible = parts.filter((p): p is string => Boolean(p && p.trim()));
  if (visible.length === 0) return null;
  return (
    <p className={cn("label-mono text-ink-30", className)}>
      {visible.map((part, i) => (
        <span key={`${i}-${part}`}>
          {part}
          {i < visible.length - 1 ? <span className="px-2 text-ink-45">·</span> : null}
        </span>
      ))}
    </p>
  );
}
