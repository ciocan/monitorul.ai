# Product

## Register

brand

## Users

monitorul.ai serves four overlapping Romanian-speaking audiences, all visiting the same surface:

- **Journalists & researchers** — looking up a specific bill, vote, or politician on deadline. Need exact quotes, unambiguous dates, durable links to cite, and confidence that the record is complete.
- **Curious citizens** — heard a name in the news and want to see what they said in parliament. Need fast comprehension without procedural jargon, and a clear path from a name to "what they actually voted on."
- **Civic-tech, academic, NGO users** — running pattern analysis across years, parties, or topics. Care about data integrity, methodology, completeness, and stable record identity across re-indexes.
- **Politicians and party staffers** — self-monitoring, opposition research. Care about freshness and comprehensiveness; should not be designed _for_, but should not be designed _around_ either.

Common context: visitors arrive from a Google result, a journalist's link, a tweet, or a search box. They want to leave with a clean URL they can paste somewhere else.

## Product Purpose

monitorul.ai is the public read surface over Romania's _Monitorul Oficial Partea a II-a_ — parliamentary records: speeches, votes, interpellations, written questions, committee meetings, annual reports, and a curated politician registry.

The data pipeline (`monitorul-ii`) does the scraping, extraction, linking, embedding, and Elasticsearch indexing. This site does one thing: make those records findable, readable, and citable on the open web. Success is when a journalist, a researcher, or a teenager writing a school paper finds what they're looking for in under a minute and leaves with a permalink they trust.

It is **not** a news outlet, **not** a government portal, **not** an AI summarisation product. It is an archive with a search box.

## Brand Personality

Three words: **civic, durable, exact.**

- **Voice:** neutral archive. Reports what happened, where, and when. No editorial framing, no hype, no "AI-powered." The records carry the weight; the interface gets out of their way. Empty states and edge cases are also archive content — say "no votes recorded for this filter" plainly, not cheerfully.
- **Aesthetic family:** editorial-archival. Comparable in spirit to ProPublica's data tools, ICIJ Offshore Leaks, theyworkforyou.com, NYT data investigations. Editorial typography (mono accents, uppercase tracked labels, sharp corners), restrained color, generous whitespace, document-first layouts.
- **Emotional goal:** quiet confidence. Visitors should feel they've arrived at a trustworthy reference, not a product. They should expect the link to still work in five years.

## Anti-references

Things this should explicitly NOT look or feel like:

- **SaaS marketing.** Gradient heroes, "AI-powered" badges, hero-metric template (big number + small label + accent), identical icon-and-arrow card grids, Vercel/Linear/Stripe landing-page clichés, dashboard chrome around content. We are not selling a tool.
- **Government portal stiffness.** Big royal-blue institutional header, dropdown menus full of acronyms, deeply nested accordions, .gov.ro design language, stiff bureaucratic layouts that signal "official but unusable." Civic, not bureaucratic.
- **News partisanship.** Tabloid red, sensational headlines, opinion mixed with fact, vote framings that signal a side, comments sections, breaking-news ticker, op-ed sidebars. We are the records, not the take. Even neutral copy should feel deliberately apart from political news sites.
- **Crypto / hacker chic.** Neon-on-black terminal aesthetic, green ASCII art, CRT scanlines, Matrix vibes. The codebase has terminal-leaning typography (mono headings, sharp corners) — but the destination is editorial restraint, not power-user cosplay.

## Design Principles

1. **The record leads.** Design recedes; the parliamentary content is the protagonist of every page. The interface is a window onto the data, never an interpreter of it. If a screen draws attention to the chrome before the content, it has failed.
2. **Trust through restraint.** Confidence comes from accuracy, completeness, and durability — not from showy visuals. Neutral archive voice. No emoji, no hype-words, no editorial framing. When in doubt, say less.
3. **Citation-grade by default.** Every page is citable: stable URL, visible date, source attribution, anchorable subsections, machine-readable metadata. A journalist should never wonder how to link a specific paragraph or what date a vote actually happened. Permalinks survive re-indexing as a design contract.
4. **Legible to any motivated citizen.** No power-user dialect, no terminal cosplay, no procedural jargon paywalls. A curious sixty-year-old reading on a tablet should reach the same comprehension as a journalist on a laptop. Density is fine when it serves comprehension; density that excludes is a bug.
5. **Show what's there; don't sell what's missing.** Empty results, unanimous votes, missing transcripts, deferred responses — all are archive states. State them plainly with the same dignity as positive results. Never hide gaps; never spin them.

## Accessibility & Inclusion

- **Target:** WCAG 2.2 AA across the site.
- **Color contrast:** verify pairs meet AA in both light and dark themes; tightening toward AAA for body copy is a stretch goal but never at the cost of typographic discipline.
- **Reduced motion:** honor `prefers-reduced-motion` for any transitions added later.
- **Keyboard:** every search filter, facet, and document navigation must be reachable and operable from keyboard alone. Pagination and result lists need explicit focus order.
- **Screen reader:** semantic landmarks per page (`main`, `nav`, `article`), descriptive headings, dates announced as full dates not bare strings.
- **Language attribute:** `<html lang>` must reflect the actual content language (currently Romanian) — fix the existing `lang="en"` in `src/app/layout.tsx` as part of the next pass.
- **Audience considerations:** older citizens reading on tablets, journalists working under time pressure, low-vision researchers — design for legibility under all three.
