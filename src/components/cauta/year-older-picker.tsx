"use client";

import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface YearOlderPickerProps {
  // Older archive years exposed in the dropdown — anything off the visible
  // chip strip. Sorted descending in the menu (most recent first).
  years: number[];
  // Years pre-selected from the URL (the off-strip subset of `?year=`).
  defaultSelected: number[];
}

// Multi-select picker for the older archive years that don't fit the chip
// strip. Each selected year is emitted as a hidden `name="year"` input so the
// form-level URL builder folds it into the comma-joined `?year=` param next to
// the chip-strip checkboxes — same shape, same submit path.
export function YearOlderPicker({ years, defaultSelected }: YearOlderPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(defaultSelected));

  const count = selected.size;
  const triggerLabel = count === 0 ? "Alt an" : `Alt an · ${count}`;

  function toggle(y: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  }

  return (
    <>
      {/* Hidden inputs for form submission. CautaFilterForm collects every
          `name="year"` value (from chip checkboxes + these) into one
          comma-joined `?year=` param. */}
      {Array.from(selected).map((y) => (
        <input key={y} type="hidden" name="year" value={String(y)} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 border border-input px-2.5 py-1 text-xs transition-colors hover:border-ink-45",
            "outline-none focus-visible:ring-1 focus-visible:ring-ink-30",
            count > 0 ? "border-ink-16 bg-ink-16 text-paper-99" : "text-ink-30",
          )}
        >
          <span className="label-mono">{triggerLabel}</span>
          <span aria-hidden className="text-[0.6875rem]">
            ↓
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} className="w-56 p-0 ring-border">
          <Command>
            <CommandInput placeholder="Caută un an…" />
            <CommandList>
              <CommandEmpty>Niciun an.</CommandEmpty>
              {years.map((y) => {
                const checked = selected.has(y);
                return (
                  <CommandItem
                    key={y}
                    value={String(y)}
                    data-checked={checked}
                    onSelect={() => toggle(y)}
                  >
                    {y}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
