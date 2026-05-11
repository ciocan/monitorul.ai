const POSTHOG_SCRIPT_ALIASES: Record<string, string> = {
  "recorder.js": "r.js",
  "posthog-recorder.js": "r.js",
  "dead-clicks-autocapture.js": "d.js",
  "posthog-dead-clicks-autocapture.js": "d.js",
  "exception-autocapture.js": "x.js",
  "posthog-exception-autocapture.js": "x.js",
  "surveys.js": "su.js",
  "posthog-surveys.js": "su.js",
  "web-vitals.js": "w.js",
  "posthog-web-vitals.js": "w.js",
  "web-vitals-with-attribution.js": "wa.js",
  "posthog-web-vitals-with-attribution.js": "wa.js",
  "toolbar.js": "tb.js",
  "posthog-toolbar.js": "tb.js",
  "tracing-headers.js": "h.js",
  "posthog-tracing-headers.js": "h.js",
};

let scriptAliasesInstalled = false;

export function installPostHogScriptAliases(): void {
  if (typeof window === "undefined" || scriptAliasesInstalled) return;
  scriptAliasesInstalled = true;

  const origCreateElement = document.createElement.bind(document);
  document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
    const el = origCreateElement(tagName, options);
    if (tagName.toLowerCase() !== "script") return el;

    Object.defineProperty(el, "src", {
      configurable: true,
      enumerable: true,
      get() {
        return this.getAttribute("src") ?? "";
      },
      set(value: string) {
        let rewritten = value;
        if (typeof value === "string" && value.includes("/trace/static/")) {
          for (const [orig, alias] of Object.entries(POSTHOG_SCRIPT_ALIASES)) {
            if (value.includes(`/trace/static/${orig}`)) {
              rewritten = value.replace(`/static/${orig}`, `/static/${alias}`);
              break;
            }
          }
        }
        this.setAttribute("src", rewritten);
      },
    });
    return el;
  }) as typeof document.createElement;
}
