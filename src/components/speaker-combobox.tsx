"use client";

import { Check, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PersonHit {
  id: string;
  slug: string;
  name: string;
  homonym: string | null;
}

export interface SpeakerComboboxProps {
  // Initial selection — the slug pre-populated from the URL on SSR. The label
  // is fetched after mount via `/api/search/persons` so the user sees the name
  // even after a back-button navigation. While loading, the slug shows.
  defaultSlug?: string;
  defaultName?: string;
  // Form-input name. The combobox writes its selected slug into this hidden
  // input; the parent form posts it on Aplică.
  name: string;
}

const FETCH_DEBOUNCE_MS = 220;
const MIN_QUERY_LENGTH = 2;

// Resolve the canonical name for a slug already present in the URL on SSR.
// Hits the same endpoint the typeahead uses; one extra request on first
// render of an active filter, but lets the chip read "Klaus Iohannis" instead
// of `klaus-iohannis` for share-link readability.
async function fetchPersonByName(name: string): Promise<PersonHit[]> {
  const res = await fetch(`/api/search/persons?q=${encodeURIComponent(name)}&limit=10`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { hits: PersonHit[] };
  return data.hits ?? [];
}

export function SpeakerCombobox({
  defaultSlug = "",
  defaultName = "",
  name,
}: SpeakerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug);
  const [selectedLabel, setSelectedLabel] = useState(defaultName || defaultSlug);
  const inputId = useId();
  const fetchSeq = useRef(0);

  // If the URL ships `?speaker=` but the parent didn't supply a label (no SSR
  // lookup), backfill once after mount. Best-effort: mismatches surface as
  // the slug remaining in the chip.
  useEffect(() => {
    if (!defaultSlug || defaultName) return;
    let cancelled = false;
    fetchPersonByName(defaultSlug.replace(/-/g, " "))
      .then((found) => {
        if (cancelled) return;
        const exact = found.find((h) => h.slug === defaultSlug);
        if (exact) setSelectedLabel(exact.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [defaultSlug, defaultName]);

  // Debounced fetch on query change. Two-char minimum keeps the network quiet
  // for accidental single keystrokes; fetchSeq guards against out-of-order
  // responses (the user keeps typing, an earlier slow response shouldn't
  // overwrite a newer fast one).
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++fetchSeq.current;
    const handle = setTimeout(async () => {
      try {
        const url = `/api/search/persons?q=${encodeURIComponent(trimmed)}&limit=10`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { hits: PersonHit[] };
        if (seq !== fetchSeq.current) return;
        setHits(data.hits ?? []);
      } catch {
        if (seq === fetchSeq.current) setHits([]);
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    }, FETCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, open]);

  const triggerLabel = useMemo(() => {
    if (selectedSlug && selectedLabel) return selectedLabel;
    return "Toți vorbitorii";
  }, [selectedSlug, selectedLabel]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="label-mono text-ink-45">
        Vorbitor
      </label>
      <input type="hidden" name={name} value={selectedSlug} />
      <Popover open={open} onOpenChange={setOpen}>
        {/* PopoverTrigger renders a <button>; the clear-X must live as a
            sibling, not a child — nested buttons are invalid HTML and break
            React hydration. The flex row makes them visually share a border. */}
        <div
          className={cn(
            "flex h-10 w-full items-stretch border border-input bg-background transition-colors",
            "focus-within:border-ink-30 focus-within:ring-1 focus-within:ring-ink-30 hover:border-ink-45",
          )}
        >
          <PopoverTrigger
            id={inputId}
            type="button"
            aria-haspopup="listbox"
            data-filter-control="speaker_open"
            data-filter-action="open"
            className={cn(
              "flex flex-1 items-center justify-between gap-2 px-3 text-left text-sm text-ink-16 outline-none",
              !selectedSlug && "text-ink-45 italic",
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            {!selectedSlug ? (
              <span aria-hidden className="label-mono text-ink-45">
                ↓
              </span>
            ) : null}
          </PopoverTrigger>
          {selectedSlug ? (
            <button
              type="button"
              aria-label="Elimină filtrul de vorbitor"
              data-filter-control="speaker_clear"
              data-filter-action="clear"
              className="grid w-9 shrink-0 place-items-center border-l border-input text-ink-45 transition-colors hover:bg-paper-96 hover:text-ink-16"
              onClick={() => {
                setSelectedSlug("");
                setSelectedLabel("");
                setQuery("");
                setOpen(false);
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-(--radix-popover-trigger-width) min-w-72 p-0 ring-border"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Caută un nume…"
              value={query}
              onValueChange={setQuery}
              autoFocus
            />
            <CommandList>
              {loading ? (
                <div className="px-2 py-3 text-xs text-ink-45">Caut…</div>
              ) : query.trim().length < MIN_QUERY_LENGTH ? (
                <div className="px-2 py-3 text-xs text-ink-45">
                  Tastați cel puțin {MIN_QUERY_LENGTH} litere…
                </div>
              ) : hits.length === 0 ? (
                <CommandEmpty>Niciun vorbitor.</CommandEmpty>
              ) : (
                hits.map((h) => {
                  const checked = h.slug === selectedSlug;
                  return (
                    <CommandItem
                      key={h.id}
                      value={h.slug}
                      data-checked={checked}
                      data-filter-control="speaker_option"
                      data-filter-action="select"
                      onSelect={() => {
                        setSelectedSlug(h.slug);
                        setSelectedLabel(h.name);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="truncate">
                        {h.name}
                        {h.homonym ? <span className="ml-2 text-ink-45">({h.homonym})</span> : null}
                      </span>
                      {checked ? <Check className="ml-auto size-3.5 text-ink-30" /> : null}
                    </CommandItem>
                  );
                })
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
