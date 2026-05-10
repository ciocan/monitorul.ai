"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  // Label shown at rest. Defaults to the Romanian "Copiază".
  label?: string;
  // Label shown for ~1.5s after a successful copy. Defaults to "Copiat".
  copiedLabel?: string;
  // Failure label, in case the clipboard write rejects (HTTPS-less / iframe
  // contexts). Defaults to "Eșuat".
  errorLabel?: string;
  className?: string;
  // Optional aria-label override; defaults to "Copiază <value>".
  ariaLabel?: string;
}

// Small client-only button that copies a static string to the clipboard.
// Voice matches the editorial register: mono uppercase, sharp corners,
// no decorative color. Reserved for in-page strings the user is meant to
// paste somewhere else (the MCP endpoint URL, config snippets, etc.).
//
// Behaviour: click → `navigator.clipboard.writeText` → temporary label
// flip ("Copiat") for 1500 ms → revert. The `aria-live` announcement gives
// screen-reader users the same feedback.
export function CopyButton({
  value,
  label = "Copiază",
  copiedLabel = "Copiat",
  errorLabel = "Eșuat",
  className,
  ariaLabel,
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("error");
    }
    window.setTimeout(() => setState("idle"), 1500);
  }

  const display = state === "copied" ? copiedLabel : state === "error" ? errorLabel : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel ?? `${label} ${value}`}
      data-state={state}
      className={cn(
        "label-mono inline-flex shrink-0 items-center justify-center px-3 py-2 text-ink-16 transition-colors hover:bg-paper-91 focus-visible:outline-2 focus-visible:outline-azure-3 focus-visible:outline-offset-2",
        "data-[state=copied]:text-azure-4 data-[state=error]:text-alert-civic",
        className,
      )}
    >
      <span aria-live="polite">{display}</span>
    </button>
  );
}
