import { Search } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export interface SiteSearchProps {
  size?: "default" | "lg";
  autoFocus?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export function SiteSearch({
  size = "default",
  autoFocus,
  placeholder = "Caută discursuri, politicieni, voturi…",
  defaultValue,
}: SiteSearchProps) {
  const isLarge = size === "lg";
  // suppressHydrationWarning on the form / input / submit button: password
  // managers (Dashlane, LastPass, 1Password, Bitwarden) inject `data-*-rid`
  // attributes onto form scaffolding after SSR, which React reports as
  // hydration mismatches. The mutations are extension-side and cosmetic;
  // suppressing here is targeted and doesn't hide real component drift.
  return (
    <form action="/cauta" method="GET" role="search" suppressHydrationWarning>
      <label htmlFor="site-search-q" className="sr-only">
        Caută în arhivă
      </label>
      <InputGroup className={cn(isLarge && "h-12")}>
        <InputGroupInput
          id="site-search-q"
          name="q"
          type="search"
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          defaultValue={defaultValue}
          suppressHydrationWarning
          className={cn(
            "placeholder:italic placeholder:text-ink-45",
            isLarge && "h-full px-4 text-base md:text-base",
          )}
        />
        <InputGroupAddon align="inline-end">
          <Kbd className="font-mono">/</Kbd>
          <InputGroupButton
            type="submit"
            size={isLarge ? "icon-sm" : "icon-xs"}
            aria-label="Caută"
            suppressHydrationWarning
          >
            <Search />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
