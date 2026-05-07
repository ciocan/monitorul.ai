---
name: monitorul.ai
description: Public read surface over Romania's parliamentary records. An archive with a search box, redesigned as a civic gazette.
colors:
  paper-99: "oklch(0.99 0.005 240)"
  paper-96: "oklch(0.965 0.006 240)"
  paper-91: "oklch(0.91 0.008 240)"
  ink-45: "oklch(0.45 0.01 240)"
  ink-30: "oklch(0.32 0.012 240)"
  ink-16: "oklch(0.16 0.012 240)"
  alert-civic: "oklch(0.55 0.22 25)"
  azure-1: "oklch(0.828 0.04 235)"
  azure-2: "oklch(0.74 0.09 237)"
  azure-3: "oklch(0.62 0.14 240)"
  azure-4: "oklch(0.5 0.13 242)"
  azure-5: "oklch(0.4 0.11 244)"
typography:
  display:
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2rem, 4vw + 1rem, 3.75rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(1.5rem, 2vw + 1rem, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.005em"
  title:
    fontFamily: "'Public Sans', system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "'Public Sans', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.16em"
  doc-heading:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  meta:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  none: "0"
  hairline: "2px"
spacing:
  hairline: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
  4xl: "64px"
  5xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ink-16}"
    textColor: "{colors.paper-99}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.ink-30}"
  button-outline:
    backgroundColor: "{colors.paper-99}"
    textColor: "{colors.ink-16}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-outline-hover:
    backgroundColor: "{colors.paper-96}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-16}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-96}"
  input-text:
    backgroundColor: "{colors.paper-99}"
    textColor: "{colors.ink-16}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
  card-record:
    backgroundColor: "{colors.paper-99}"
    rounded: "{rounded.none}"
    padding: "20px"
  chip-tag:
    backgroundColor: "{colors.paper-96}"
    textColor: "{colors.ink-30}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "2px 8px"
---

# Design System: monitorul.ai

## 1. Overview

**Creative North Star: "The Public Record"**

monitorul.ai is a parliamentary record archive redesigned as a civic gazette. The visual system reads as a published volume of public record — datelined, citable, formal without being bureaucratic, archival without being austere. It is what _Monitorul Oficial_ would look like if it had been redesigned by an editorial design studio with a brief that said "respect the reader, respect the records, and disappear."

Every page is a document; every chart is a citation; every search result is an entry in a register. Chrome is minimal because the parliamentary record is the protagonist, not the navigation. Headings use a serif voice for narrative surfaces (landing, person profiles, document openings) and a mono voice for in-document section labels (vote outcomes, agenda items, dates) — the two registers signal: _here is the public-facing summary_, vs. _here are the records themselves_.

This system explicitly rejects: the SaaS marketing idiom (gradients, glow, hero-metric template), the government portal idiom (royal blue, accordion-trees, acronym soup), the news partisanship idiom (tabloid red, opinion-mixed-with-fact), and the crypto/hacker idiom (neon-on-black, CRT scanlines, ASCII art). The destination is editorial restraint, not power-user cosplay.

**Key Characteristics:**

- Sharp corners (`rounded-none`) by default; the `hairline` 2px radius is reserved for chips and badges only.
- Tinted neutrals on a cool civic axis (hue 240). Pure white and pure black are forbidden.
- Two-register typography: editorial serif (Source Serif 4) for display, mono (IBM Plex Mono) for in-document headings and labels, body sans (Public Sans) for everything else.
- Flat by default; depth comes from rule lines and tonal layering, never decorative shadows.
- Generous whitespace at the page level; dense tabular layout inside records when warranted.
- Uppercase tracked mono labels carry section affordances ("VOTURI · 2024-03-12 · CAMERA DEPUTAȚILOR").

## 2. Colors

The palette is monochrome on a cool civic axis, with one editorial accent (an archival cool blue) for charts and links, and one civic alert color (a red shifted away from tabloid heat) for destructive actions and uncast votes. There is no decorative color. Every color earns its place by carrying meaning.

### Primary

- **Ink** (`oklch(0.16 0.012 240)`): the color the records are printed in. Body text on light surfaces. The default link color (with underline). Default button background. Used wherever the document needs to be authoritative.
- **Paper** (`oklch(0.99 0.005 240)`): the surface the records sit on. The page background. Default button text on `Ink` backgrounds. Reads as a barely-cool ivory; never as pure white.

### Secondary

- **Civic Azure** (`oklch(0.5 0.13 242)`): the editorial accent. Used for active filters, focused states, links on hover (sparingly), chart series, and the citation accent stripe on cited entities. Never used as a button background; never used in gradients. The 5-stop ramp `azure-1` through `azure-5` is reserved for charts and data viz.

### Tertiary

- **Alert Civic** (`oklch(0.55 0.22 25)`): a deliberately-cooled red, dialed away from tabloid hot-red. Reserved for: destructive button states, error toasts, "vot respins" outcomes, missing-record warnings. Never used decoratively.

### Neutral

- **Paper Muted** (`oklch(0.965 0.006 240)`): an aged-paper hue. Used for muted backgrounds, search filter row, table thead, secondary cards.
- **Rule Line** (`oklch(0.91 0.008 240)`): the rule lines that separate records, table rows, sections. The system's primary depth cue.
- **Ink Muted** (`oklch(0.45 0.01 240)`): faded ink for secondary text, dates, metadata, captions.

### Named Rules

**The Cool Axis Rule.** All neutrals tint toward hue 240 with chroma between 0.005 and 0.012. Pure `#000` / `#fff` (or `oklch(0 0 0)` / `oklch(1 0 0)`) are forbidden. Even when a token reads as "white," it is `Paper-99` and carries the cool drift.

**The One Accent Rule.** Civic Azure is used on ≤ 10% of any single screen. Its rarity is the point. If two distinct UI elements would both want azure, one of them is wrong.

**The No Decorative Color Rule.** No color exists for tone or warmth. If a color appears on screen, it is doing semantic work: data, link, citation, alert, or selection. Removing the color would damage comprehension.

## 3. Typography

**Display Font:** Source Serif 4 (with Georgia, Times New Roman fallback)
**Body Font:** Public Sans (with system-ui fallback)
**Label / Mono Font:** IBM Plex Mono (with ui-monospace fallback)

**Character:** A three-voice system. Source Serif 4 carries the editorial register — a transitional serif with open counters, optical sizing, and the quiet authority of a published reference. Public Sans carries the body register — designed by the U.S. Digital Service for civic use, neutral and legible without affectation. IBM Plex Mono carries the document register — uppercase tracked labels, dates, IDs, and in-record section headings, signaling "this is where the data lives." All three are open-source, variable, and cover full Romanian Latin Extended-A diacritics (ă â î ș ț).

### Hierarchy

- **Display** (Source Serif 4, weight 400, `clamp(2rem, 4vw + 1rem, 3.75rem)`, line-height 1.05, letter-spacing -0.01em): landing page hero, person profile names on `/politicieni/<slug>`, the title of a document opener on `/mo/<id>`. Used at most once per page.
- **Headline** (Source Serif 4, weight 400, `clamp(1.5rem, 2vw + 1rem, 2.25rem)`, line-height 1.15, letter-spacing -0.005em): section openers on long-form pages, list-page titles ("Toate sesiunile / 2024").
- **Title** (Public Sans, weight 600, 17px, line-height 1.35): card titles, search-result row titles, panel headings.
- **Body** (Public Sans, weight 400, 15px, line-height 1.55, max-width 65–75ch): all running prose, search result snippets, speech text on `/discurs/<slug>`. Cap line length at 65–75ch on text-heavy pages.
- **Label** (IBM Plex Mono, weight 500, 11px, line-height 1.2, letter-spacing 0.16em, **uppercase**): table headers, section affordances, filter group labels, breadcrumb separators. The signature "uppercase tracked mono" voice that anchors the archival register.
- **Doc-heading** (IBM Plex Mono, weight 600, 16px, line-height 1.3): in-document section headings on records (vote panels, agenda items, interpellation sections). Already in use in `mdx-components.tsx`.
- **Meta** (IBM Plex Mono, weight 400, 12px, line-height 1.4, letter-spacing 0.04em): dates, IDs, fingerprints, technical metadata, citation strings.

### Named Rules

**The Two-Register Rule.** Source Serif 4 voices the human-facing surface (landing, hero, profile names, openers). IBM Plex Mono voices the record-facing surface (in-document headings, dates, IDs, table labels). Public Sans voices everything else. A page that mixes Source Serif 4 with mono labels has not violated the system; a page that uses Source Serif 4 inside a record body has.

**The Numerals-Are-Mono Rule.** Vote counts, dates, IDs, percentages, durations, and any data-bearing numeral set on screen uses IBM Plex Mono (or Public Sans's tabular-numerals feature, `font-variant-numeric: tabular-nums`). Never a proportional serif numeral set inside a data table.

**The Quiet Headlines Rule.** Display and Headline use weight 400 — the same weight as body. Hierarchy comes from size, leading, and letter-spacing, not weight contrast. Bold display headlines belong in news media, not in this archive.

## 4. Elevation

Flat by default. The system uses tonal layering and rule lines as its primary depth cues. Shadows do not exist on cards, panels, surfaces, or any element at rest. Depth is conveyed through:

1. **Tonal layering** — `Paper-99` (page) → `Paper-96` (muted backgrounds, table thead, sticky filters) → `Paper-91` (rule lines, dividers).
2. **Rule lines** — 1px hairlines at `Paper-91` separate records, table rows, sections, and panel groups. The most-used depth cue in the system. Borrows directly from print archives.
3. **State-only shadow** — only `:hover` on actionable rows / cards and `:focus-visible` on inputs may carry a shadow, and only as a faint ambient (`0 1px 0 0 oklch(0.16 0.012 240 / 0.08)`). Never a Material-style ambient + key shadow stack.

### Shadow Vocabulary

- **`shadow-state-hover`** (`box-shadow: 0 1px 0 0 oklch(0.16 0.012 240 / 0.08)`): faint ground-shadow for interactive rows on hover. Vanishes at rest.
- **`shadow-focus-ring`** (`box-shadow: 0 0 0 2px oklch(0.5 0.13 242 / 0.4)`): the focus ring on inputs, buttons, links. The system's only "blue glow."

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. If you reach for a shadow to separate two regions, use a 1px rule line instead. If you reach for a shadow to lift a card, use `Paper-96` as a tonal layer instead. If you reach for a shadow to convey hover, you have permission — but only the hairline state shadow above.

**The No Decorative Shadow Rule.** Drop shadows for "elevation" on cards at rest are forbidden. Glassmorphism, backdrop-blur, and inner glows are forbidden. The interface is printed, not lit.

## 5. Components

### Buttons

- **Shape:** Sharp corners always (`rounded-none`, 0px). The size scale (`xs` 6px, `sm` 7px, `default` 8px, `lg` 9px height in the existing button) stays as-is.
- **Voice:** Buttons speak in mono. The label is set in IBM Plex Mono, weight 500, 11px, uppercase, letter-spacing 0.16em.
- **Primary** (`Ink-16` background, `Paper-99` text, no border): default. Used for the canonical action of a page (submit search, view record). One per primary action region.
- **Outline** (`Paper-99` background, `Ink-16` text, 1px `Paper-91` border): secondary actions. Resets active filters, cancel, dismiss.
- **Ghost** (transparent background, `Ink-16` text, no border): tertiary actions, dense table-row actions, dropdown triggers.
- **Destructive** (`Alert-civic` 10% background, `Alert-civic` text): rare; reserved for explicit destructive flows. The current `destructive` variant in `button.tsx` already implements this approach — keep it.
- **Link** (no background, `Ink-16` text, underline-on-hover): inline action that should look like prose (cite, copy permalink, share).
- **Hover:** Primary darkens to `Ink-30`; Outline / Ghost shift to `Paper-96`. No transform, no shadow on the button itself; allow the existing 1px translate-on-active for tactile feedback.

### Inputs

- **Shape:** Sharp (`rounded-none`).
- **Default:** `Paper-99` background, `Ink-16` text, 1px `Paper-91` border on all four sides. No floating labels; labels sit above inputs in `label` typography (uppercase mono).
- **Focus:** Border shifts to `Civic Azure` (`azure-3`) at 1px, with the system focus ring (`shadow-focus-ring`) outside the border. No glow; no animated underline.
- **Search input** (signature): full-width on mobile, fixed-width on desktop; placeholder set in body Public Sans italic at `Ink-45`. The search button is icon-only mono on the right; the keyboard shortcut `/` is shown as a `chip-tag` inside the right edge of the input.
- **Disabled / error:** disabled at 50% opacity; error inputs gain a 1px `Alert-civic` border with the error message below in body Public Sans at `Alert-civic`.

### Cards / Records

- **Shape:** Sharp; never a card with a colored side-stripe (banned).
- **Background:** `Paper-99` (page-level) or `Paper-96` (within a list of records).
- **Border:** 1px `Paper-91` on top and bottom only when the card sits in a list; full 1px border on all four sides when the card is freestanding (e.g. a single highlighted record on a landing page). Never a border on three sides.
- **Internal padding:** `xl` (24px) on freestanding records, `lg` (16px) on list-row records.
- **Header:** mono label across the top (`MO 2024-47 · CAMERA DEPUTAȚILOR · 12 MARTIE 2024`), then the title in `headline` (Source Serif) for record openers or `title` (Public Sans) for list rows.
- **Hover (when actionable):** `Paper-99` background; `shadow-state-hover` ground shadow; underline on the title. No translation, no scale.

### Tables (signature: search results, vote tallies, person profile mandates)

- **thead:** `Paper-96` background, mono label typography (uppercase, tracked 0.16em, 11px), 1px `Paper-91` bottom border. The `mdx-components.tsx` table treatment is the canonical reference.
- **tbody:** Public Sans body 13–15px, vertical alignment top, 1px `Paper-91` bottom border per row. Tabular numerals on numeric columns.
- **Hover row:** `Paper-96` background. Whole row clickable when the table represents records; never just the title cell.
- **Density:** 8–10px vertical row padding for archival tables; 12–14px for short list tables. Match density to the volume of data, not to a single global default.

### Chips / Tags

- **Shape:** `hairline` 2px radius (the only place in the system where rounding is permitted).
- **Default:** `Paper-96` background, `Ink-30` text, mono label typography.
- **Selected (in filter rows):** `Ink-16` background, `Paper-99` text.
- **Use:** filter facets ("Camera Deputaților"), entity tags on records (party group at time, committee), keyboard-shortcut hints inside inputs.

### Navigation

- **Site nav:** a single 1px-rule-bottom horizontal bar at the top of every page. No drop shadow. Logo at left in `display` Source Serif at 18px / weight 400; menu items at right in `label` mono uppercase tracked.
- **Active state:** the active item gains a 2px `Civic Azure` underline (`box-shadow: inset 0 -2px 0 ...`), not a fill.
- **Mobile:** the nav collapses to a single `Meniu` mono label that opens a full-screen panel with all items as a vertical list. No hamburger icon.
- **Breadcrumb:** mono label, separator is ` · ` (middle-dot with surrounding spaces), never a `>` or `/`.

### Dateline (signature component)

A short mono uppercase strip that appears at the top of every record-bearing page:

```
MONITORUL OFICIAL  ·  PARTEA II  ·  CAMERA DEPUTAȚILOR  ·  12 MARTIE 2024
```

This is the system's signature affordance. It sets the editorial register on every page within three words. Never decorate it; never add an icon; never break it across two lines except on viewports < 640px (where it wraps with the same separator).

## 6. Do's and Don'ts

### Do:

- **Do** tint every neutral toward hue 240 with chroma 0.005–0.012. The Cool Axis Rule is non-negotiable.
- **Do** set buttons, inputs, cards, panels, and nav with `rounded-none`. Sharp corners are the system signature.
- **Do** speak in mono uppercase tracked labels (IBM Plex Mono, 11px, letter-spacing 0.16em) for section affordances, table headers, dates, IDs.
- **Do** use 1px `Paper-91` rule lines as the primary depth cue. Borrow from print archives, not from app shells.
- **Do** apply `font-variant-numeric: tabular-nums` to every column of numbers in a data table. Vote counts, percentages, durations.
- **Do** keep body line length ≤ 65–75ch. Cap the prose container, not the page.
- **Do** show the dateline at the top of every record-bearing page in the canonical mono uppercase format.
- **Do** carry citation affordances (permalink, ID, indexed-at date) on every record. _Citation-grade by default._
- **Do** state empty states plainly: "No votes recorded for this filter. Try widening the date range." No cheerful microcopy, no illustrations.
- **Do** verify color contrast meets WCAG 2.2 AA in both light and dark themes before shipping any new surface.

### Don't:

- **Don't** use pure `#000` / `#fff` or `oklch(0 0 0)` / `oklch(1 0 0)` for any neutral. The current `globals.css` uses both — update them to the tinted scale before adding new pages.
- **Don't** add a left-border accent stripe to alerts, callouts, list items, or cards. Banned by the impeccable shared design law and reaffirmed here.
- **Don't** render text with `background-clip: text` and a gradient fill. Banned. Solid color, weight, or size for emphasis.
- **Don't** use glassmorphism, `backdrop-filter: blur(...)`, or any variant of frosted-glass surfaces.
- **Don't** place an icon-and-label hero metric (big number + small label + accent) on landing or dashboard pages. The hero-metric template is the SaaS-marketing tell.
- **Don't** ship identical icon-and-arrow card grids ("Find · Filter · Cite"). Cards are a lazy answer; nested cards are always wrong.
- **Don't** reach for a modal as the first thought. Inline reveal, route navigation, or a dedicated page first.
- **Don't** apply gradient backgrounds, neon glows, or accent borders to convey importance. Importance is conveyed by typography and placement.
- **Don't** import royal-blue civic-portal patterns: institutional headers with seal motifs, deeply-nested accordions, dropdown menus full of acronyms. Civic, not bureaucratic.
- **Don't** use tabloid red (`oklch(0.62 0.27 27)` and hotter). The civic alert red sits at `oklch(0.55 0.22 25)` and never gets warmer.
- **Don't** add CRT scanlines, ASCII art, neon-on-black, or any "hacker terminal" decoration. The codebase has terminal-leaning typography because mono is editorial; we are not cosplaying a terminal.
- **Don't** animate CSS layout properties (width, height, top, left, padding). Use `transform` and `opacity` only.
- **Don't** add an em-dash or `--` to UI copy. Use commas, colons, semicolons, periods, or parentheses.
- **Don't** carry shadows on cards or surfaces at rest. Flat by default.
- **Don't** use Source Serif 4 anywhere inside a record body. Display and headline only.
