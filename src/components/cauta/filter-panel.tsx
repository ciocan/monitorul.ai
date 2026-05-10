import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { CautaFilterForm } from "@/components/cauta/filter-form";
import { YearOlderPicker } from "@/components/cauta/year-older-picker";
import { SpeakerCombobox } from "@/components/speaker-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartyEnumerationRow } from "@/lib/search";
import { type CautaSearchParams, type SortSlug, activeFilterCount } from "@/lib/search-params";
import { cn } from "@/lib/utils";

// Year chips pin the last few years; "Alt an" surfaces the older archive via
// a native <select>. The form-level URL builder strips empty values, so the
// "Toate" radios below carry value="" without polluting share-links.
const YEAR_CHIPS = 5;
const ARCHIVE_YEAR_MIN = 1990;
const ARCHIVE_YEAR_MAX = 2100;

function yearChipRange(currentYear: number): number[] {
  const out: number[] = [];
  for (let y = currentYear; y > currentYear - YEAR_CHIPS; y -= 1) out.push(y);
  return out;
}

function olderYearOptions(currentYear: number): number[] {
  const out: number[] = [];
  for (let y = currentYear - YEAR_CHIPS; y >= ARCHIVE_YEAR_MIN; y -= 1) out.push(y);
  return out;
}

export interface FilterPanelProps {
  params: CautaSearchParams;
  partyEnumeration: PartyEnumerationRow[];
  // Resolved canonical name for the speaker slug, when known. Saves the client
  // combobox a round-trip on first render of an active filter.
  speakerName: string | null;
  // Number of "active" parties to surface above the "Alte" optgroup.
  topPartyCount?: number;
}

const SORT_LABELS: Record<SortSlug, string> = {
  relevance: "Relevanță",
  "date-desc": "Data ↓",
  "date-asc": "Data ↑",
};

export function FilterPanel({
  params,
  partyEnumeration,
  speakerName,
  topPartyCount = 12,
}: FilterPanelProps) {
  const activeCount = activeFilterCount(params);
  const isOpen = activeCount > 0;
  const today = new Date();
  const currentYear =
    today.getUTCFullYear() <= ARCHIVE_YEAR_MAX ? today.getUTCFullYear() : ARCHIVE_YEAR_MAX;
  const yearChips = yearChipRange(currentYear);
  const olderYears = olderYearOptions(currentYear);

  const yearSet = new Set(params.years);
  // The older-picker holds every selected year that's outside the visible chip
  // strip — multi-select, so all off-strip years stay co-active alongside the
  // chips. Each emits its own `name="year"` hidden input on submit; the form
  // collects them into the comma-joined `?year=` param.
  const offStripYears = params.years.filter((y) => !yearChips.includes(y)).sort((a, b) => b - a);

  const topParties = partyEnumeration.slice(0, topPartyCount);
  const otherParties = partyEnumeration.slice(topPartyCount);

  return (
    // When closed: a single rule under the search input (panel recedes).
    // When open: the panel recesses onto paper-96 with a thicker ink-16 top
    //            seal so it reads as a deliberate "filter drawer" dropped into
    //            the gazette page — paper-shift + sharp top edge + label
    //            caption inside, no shadows or rounded corners.
    // suppressHydrationWarning: <details>.open is browser-managed — clicking
    // the <summary> toggles it natively, outside React. After a soft nav
    // (router.push from the filter form) or a click that races with hydration,
    // the DOM's open attribute can desync from the tree's `open` prop. The
    // mismatch is cosmetic and self-corrects on the next user interaction.
    <details
      suppressHydrationWarning
      className={cn(
        "group/filters mt-6 border-y border-border transition-colors",
        "[&[open]]:border-t-ink-16 [&[open]]:border-t-2 [&[open]]:bg-paper-96",
      )}
      open={isOpen}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between px-1 py-3",
          "label-mono text-ink-30 transition-colors hover:text-ink-16",
          "group-open/filters:py-4 group-open/filters:text-ink-16",
          "marker:hidden [&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="flex items-center gap-3">
          <span>Filtre</span>
          {activeCount > 0 ? (
            <span
              data-tabular-nums=""
              className="bg-ink-16 px-1.5 py-0.5 text-[0.6875rem] leading-none text-paper-99"
            >
              {activeCount}
            </span>
          ) : null}
        </span>
        <span aria-hidden className="label-mono text-ink-45">
          <span className="group-open/filters:hidden">Deschide ↓</span>
          <span className="hidden group-open/filters:inline">Închide ↑</span>
        </span>
      </summary>

      <CautaFilterForm>
        {/* Carry the q forward — the search input itself sits above the panel,
            but the form needs `name="q"` so submission keeps the query. */}
        <input type="hidden" name="q" value={params.q} />
        <div className="grid gap-x-8 gap-y-6 px-3 py-5 md:grid-cols-2 md:px-4">
          <YearField
            yearSet={yearSet}
            chips={yearChips}
            olderYears={olderYears}
            olderSelected={offStripYears}
          />
          <ChamberField selected={params.chamber} />
          <div className="md:col-span-1">
            <SpeakerCombobox
              name="speaker"
              defaultSlug={params.speakerSlug}
              defaultName={speakerName ?? ""}
            />
          </div>
          {partyEnumeration.length > 0 ? (
            <PartyField
              selected={params.partySlug}
              topParties={topParties}
              otherParties={otherParties}
            />
          ) : null}
          <ProceduralField checked={params.includeProcedural} />
          <SortField selected={params.sort} />
          <HawkinsField selected={params.hawkinsScores} />
          <VpartyField selected={params.vpartyScores} />
          <DqiField selected={params.dqiLevelMin} />
          <DiscourseChipsField voiceMode={params.voiceMode} confidenceMin={params.confidenceMin} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-91 px-3 py-3 md:px-4">
          <p className="label-mono text-ink-45">
            Apăsați Aplică pentru a căuta cu filtrele setate.
          </p>
          <Button type="submit" size="lg" className="px-5 text-sm">
            Aplică filtre
          </Button>
        </div>
      </CautaFilterForm>
    </details>
  );
}

function FieldHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="label-mono text-ink-45">{label}</span>
      {hint ? <span className="text-[0.6875rem] text-ink-45">{hint}</span> : null}
    </div>
  );
}

// Chip styling shared by the multi-year checkboxes and the chip-radio items.
// Active state for chips that wrap a Radix primitive (Checkbox / RadioGroup
// item) is signalled via `data-state="checked"`; the wrapper class string
// must be literal for Tailwind's static class detection to pick it up.
const CHIP_CLASSES = cn(
  "inline-flex cursor-pointer items-center border border-input px-2.5 py-1 text-xs text-ink-30 transition-colors hover:border-ink-45",
  "outline-none focus-visible:ring-1 focus-visible:ring-ink-30",
  "data-[state=checked]:border-ink-16 data-[state=checked]:bg-ink-16 data-[state=checked]:text-paper-99",
);

function YearField({
  yearSet,
  chips,
  olderYears,
  olderSelected,
}: {
  yearSet: Set<number>;
  chips: number[];
  olderYears: number[];
  olderSelected: number[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="An" hint="multi-selecție" />
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((y) => (
          <YearChip key={y} year={y} checked={yearSet.has(y)} />
        ))}
        {/* Older-archive picker — Popover + Command, multi-select. Selected
            older years emit hidden `name="year"` inputs alongside the chip
            checkboxes; CautaFilterForm collapses every `year` value into a
            single `?year=2007,2010` param. Re-mounted on URL change via the
            joined-key so soft-nav resets stale client state. */}
        <YearOlderPicker
          key={`year-older-${olderSelected.join(",")}`}
          years={olderYears}
          defaultSelected={olderSelected}
        />
      </div>
    </fieldset>
  );
}

// Multi-select year chip backed by Radix Checkbox. The Checkbox emits a hidden
// `<input name="year">` only when checked, so the browser's form-submit
// produces multiple `year=` entries that CautaFilterForm folds into a single
// comma-joined `?year=` param. We use the Radix primitive directly (rather
// than the shadcn Checkbox wrapper) because the chip *is* the control —
// there's no visible checkbox indicator inside the chip.
function YearChip({ year, checked }: { year: number; checked: boolean }) {
  // `key` includes the URL-derived `checked` state so a soft navigation that
  // changes the selection forces a remount of this Radix Checkbox — without
  // it, the client-side `defaultChecked` is sticky from the previous render
  // and chip-removal links leave the underlying checkbox stale (which then
  // re-submits the cleared year on the next Aplică).
  return (
    <CheckboxPrimitive.Root
      key={`year-${year}-${checked}`}
      name="year"
      value={String(year)}
      defaultChecked={checked}
      data-slot="year-chip"
      className={CHIP_CLASSES}
    >
      {year}
    </CheckboxPrimitive.Root>
  );
}

function ChamberField({ selected }: { selected: string | null }) {
  const options: Array<{ value: string; label: string }> = [
    { value: "", label: "Toate" },
    { value: "cd", label: "Camera Deputaților" },
    { value: "senat", label: "Senat" },
  ];
  // selected here is the resolved Chamber name, not the slug; map back for
  // the RadioGroup default value.
  const selectedSlug =
    selected === "Camera Deputaților" ? "cd" : selected === "Senat" ? "senat" : "";
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="Cameră" />
      <RadioGroup
        key={`chamber-${selectedSlug}`}
        name="chamber"
        defaultValue={selectedSlug}
        className="flex flex-row flex-wrap gap-1.5"
      >
        {options.map((opt) => (
          <ChipRadioItem key={opt.value || "all"} value={opt.value} label={opt.label} />
        ))}
      </RadioGroup>
    </fieldset>
  );
}

// Chip-styled RadioGroup item. Replaces the default Radix circle indicator
// with a chip that highlights via data-state. Used by Chamber + Sort.
function ChipRadioItem({ value, label }: { value: string; label: string }) {
  return (
    <RadioGroupPrimitive.Item value={value} className={CHIP_CLASSES}>
      {label}
    </RadioGroupPrimitive.Item>
  );
}

// shadcn `Select` (Radix-based) for the party-at-time dropdown. Optgroup
// shape preserved via SelectGroup + SelectLabel. Field is hidden by the panel
// when the upstream enumeration is empty — see filter-panel.tsx.
function PartyField({
  selected,
  topParties,
  otherParties,
}: {
  selected: string;
  topParties: PartyEnumerationRow[];
  otherParties: PartyEnumerationRow[];
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <FieldHeader label="Grup parlamentar (atunci)" hint="la momentul discursului" />
      {/* Radix Select doesn't allow an empty-string SelectItem value, so the
          "no selection" state is rendered as a placeholder on the trigger.
          To clear, the user removes the filter via the active chip row or
          the Resetează filtrele link. */}
      <Select key={`party-${selected}`} name="party" defaultValue={selected || undefined}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder="Toate grupurile" />
        </SelectTrigger>
        <SelectContent>
          {topParties.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Cele mai active</SelectLabel>
              {topParties.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.raw}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {otherParties.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Alte</SelectLabel>
              {otherParties.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.raw}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>
    </fieldset>
  );
}

// shadcn Checkbox for the procedural toggle. The CautaFilterForm wrapper
// strips the empty-string when unchecked; when checked, Radix emits the
// hidden input and the form serialises `procedural=1`.
function ProceduralField({ checked }: { checked: boolean }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="Conținut" />
      <Label className="flex cursor-pointer items-start gap-2 text-sm text-ink-30">
        <Checkbox
          key={`procedural-${checked}`}
          name="procedural"
          value="1"
          defaultChecked={checked}
          className="mt-0.5"
        />
        <span className="leading-snug">
          Include intervenții procedurale
          <span className="block text-xs text-ink-45">
            Implicit, doar discursurile substanțiale (≥ 100 caractere) sunt afișate.
          </span>
        </span>
      </Label>
    </fieldset>
  );
}

function SortField({ selected }: { selected: SortSlug }) {
  const values: SortSlug[] = ["relevance", "date-desc", "date-asc"];
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="Sortare" />
      <RadioGroup
        key={`sort-${selected}`}
        name="sort"
        defaultValue={selected}
        className="flex flex-row flex-wrap gap-1.5"
      >
        {values.map((v) => (
          <ChipRadioItem key={v} value={v} label={SORT_LABELS[v]} />
        ))}
      </RadioGroup>
    </fieldset>
  );
}

// Discourse-UI Phase 5 fields. The form-level URL builder collapses each
// `name="hawkins"` / `name="vparty"` checkbox into the comma-joined `?hawkins=`
// / `?vparty=` URL params (same trick as the existing year chips).

function HvScoreChips({
  name,
  selected,
}: {
  name: "hawkins" | "vparty";
  selected: Array<0 | 1 | 2>;
}) {
  const set = new Set(selected);
  const values: Array<0 | 1 | 2> = [0, 1, 2];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <CheckboxPrimitive.Root
          key={`${name}-${v}-${set.has(v)}`}
          name={name}
          value={String(v)}
          defaultChecked={set.has(v)}
          data-slot={`${name}-chip`}
          className={CHIP_CLASSES}
        >
          {v}
        </CheckboxPrimitive.Root>
      ))}
    </div>
  );
}

function HawkinsField({ selected }: { selected: Array<0 | 1 | 2> }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="Populism (Hawkins)" hint="0 / 1 / 2" />
      <HvScoreChips name="hawkins" selected={selected} />
    </fieldset>
  );
}

function VpartyField({ selected }: { selected: Array<0 | 1 | 2> }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="Anti-pluralism (V-Party)" hint="0 / 1 / 2" />
      <HvScoreChips name="vparty" selected={selected} />
    </fieldset>
  );
}

function DqiField({ selected }: { selected: 1 | 2 | 3 | null }) {
  const options: Array<{ value: string; label: string }> = [
    { value: "", label: "Toate" },
    { value: "1", label: "≥ L1" },
    { value: "2", label: "≥ L2" },
    { value: "3", label: "≥ L3" },
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="Calitate deliberativă (DQI ≥)" />
      <RadioGroup
        key={`dqi-${selected ?? "none"}`}
        name="dqi"
        defaultValue={selected ? String(selected) : ""}
        className="flex flex-row flex-wrap gap-1.5"
      >
        {options.map((opt) => (
          <ChipRadioItem key={opt.value || "all"} value={opt.value} label={opt.label} />
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function DiscourseChipsField({
  voiceMode,
  confidenceMin,
}: {
  voiceMode: "first-person" | "all";
  confidenceMin: number | null;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <FieldHeader label="Voce + încredere" />
      <div className="flex flex-row flex-wrap gap-1.5">
        <RadioGroup
          key={`voice-${voiceMode}`}
          name="voice"
          defaultValue={voiceMode === "all" ? "all" : ""}
          className="flex flex-row flex-wrap gap-1.5"
        >
          <ChipRadioItem value="" label="Vocea proprie" />
          <ChipRadioItem value="all" label="Toate vocile" />
        </RadioGroup>
        <RadioGroup
          key={`conf-${confidenceMin ?? "none"}`}
          name="conf"
          defaultValue={confidenceMin === 0.7 ? "07" : ""}
          className="flex flex-row flex-wrap gap-1.5"
        >
          <ChipRadioItem value="" label="Toate codările" />
          <ChipRadioItem value="07" label="Doar ≥ 0.7" />
        </RadioGroup>
      </div>
    </fieldset>
  );
}
