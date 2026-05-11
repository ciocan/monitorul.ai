import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SearchTracker } from "@/components/analytics/search-tracker";
import { ActiveFilters } from "@/components/cauta/active-filters";
import { FilterPanel } from "@/components/cauta/filter-panel";
import { Pagination } from "@/components/pagination";
import { SiteSearch } from "@/components/site-search";
import { SpeechLengthMeter } from "@/components/speech-length-meter";
import { hasDiacritics } from "@/lib/analytics";
import type { SearchPerformedProps } from "@/lib/analytics";
import { formatCount, formatDate, speechWordCount } from "@/lib/format";
import {
  type PartyEnumerationRow,
  dePartySlugs,
  listPartyEnumeration,
  searchPersons,
  searchSpeeches,
} from "@/lib/search";
import {
  type CautaSearchParams,
  type SortSlug,
  activeFilterCount,
  buildCautaHref,
  parseCautaSearchParams,
} from "@/lib/search-params";
import type { MoSpeech } from "@/lib/types";

// Per docs/elasticsearch-indexing.md §Q7: search-results pages are
// `noindex, follow`. They're not citable archive content; the records they
// link to are. Dynamic per-query render — no ISR.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const params = parseCautaSearchParams(sp);
  const title = params.q ? `Căutare: ${params.q}` : "Caută în arhivă";
  return {
    title,
    description: params.q
      ? `Rezultate pentru „${params.q}” în arhiva Monitorului Oficial.`
      : "Caută discursuri, voturi, interpelări, politicieni și ședințe în arhiva publică.",
    robots: { index: false, follow: true },
    alternates: { canonical: "/cauta" },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const params = parseCautaSearchParams(sp);
  // Party enumeration is needed regardless of whether the user filtered by
  // party — the panel always renders. Cached server-side (1h TTL).
  const partyEnumeration = await listPartyEnumeration().catch(() => [] as PartyEnumerationRow[]);
  // Resolve speaker label up-front so SSR + the active-chip row both have it.
  const speakerName = params.speakerSlug
    ? await resolveSpeakerName(params.speakerSlug).catch(() => null)
    : null;
  const partyLabel = partyEnumeration.find((row) => row.slug === params.partySlug)?.raw ?? null;

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <header className="border-b border-border pb-8">
        <p className="label-mono text-ink-30">Căutare</p>
        <h1 className="font-display mt-2 text-3xl text-ink-16 sm:text-4xl">
          {params.q ? <>Rezultate pentru „{params.q}”</> : "Caută în arhivă"}
        </h1>
        <div className="mt-6 max-w-3xl">
          <SiteSearch size="lg" defaultValue={params.q} autoFocus={!params.q} />
        </div>
        <p className="mt-3 max-w-prose text-sm text-ink-45">
          Căutarea acoperă discursurile substanțiale (lungime ≥ 100 caractere) din stenograme.
          Voturile, interpelările, întrebările și ședințele de comisie vor fi adăugate în paginile
          de căutare următoare.
        </p>
        <FilterPanel
          params={params}
          partyEnumeration={partyEnumeration}
          speakerName={speakerName}
        />
        <ActiveFilters params={params} speakerLabel={speakerName} partyLabel={partyLabel} />
      </header>

      {params.q || hasFilter(params) ? (
        <Suspense key={suspenseKey(params)} fallback={<SearchResultsSkeleton />}>
          <SearchResults params={params} partyEnumeration={partyEnumeration} />
        </Suspense>
      ) : (
        <EmptyQuery />
      )}
    </div>
  );
}

function hasFilter(p: CautaSearchParams): boolean {
  return activeFilterCount(p) > 0;
}

function suspenseKey(p: CautaSearchParams): string {
  return [
    p.q,
    p.page,
    p.dateFrom,
    p.dateTo,
    p.years.join(","),
    p.chamber ?? "",
    p.speakerSlug,
    p.partySlug,
    p.speechSizes.join(","),
    p.includeProcedural ? "1" : "",
    p.sort,
    p.hawkinsScores.join(","),
    p.vpartyScores.join(","),
    p.dqiLevelMin ?? "",
    p.voiceMode,
    p.confidenceMin ?? "",
  ].join("|");
}

async function resolveSpeakerName(slug: string): Promise<string | null> {
  // The slug is the canonical name's slugified form; round-trip via
  // searchPersons since the layer doesn't expose a getPerson(slug) shortcut
  // for slugs (they aren't keyword-indexed for `term` lookups). The combobox
  // does the same on the client; one of the two pre-renders the chip label.
  const probe = slug.replace(/-/g, " ");
  const persons = await searchPersons(probe, 5);
  return persons.find((p) => p.slug === slug)?.canonical_name ?? null;
}

function SearchResultsSkeleton() {
  return (
    <section className="mt-10" aria-busy="true" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label-mono text-ink-30">Caut…</p>
        <p className="label-mono text-ink-45" data-tabular-nums="">
          <span className="text-ink-30">Hibrid</span> · — ms
        </p>
      </div>
      <ol className="mt-6 divide-y divide-border border-y border-border" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="px-1 py-5">
            <div className="h-2 w-48 animate-pulse bg-paper-91" />
            <div className="mt-3 h-4 w-2/5 animate-pulse bg-paper-91" />
            <div className="mt-3 h-3 w-11/12 max-w-prose animate-pulse bg-paper-91/70" />
            <div className="mt-2 h-3 w-3/4 max-w-prose animate-pulse bg-paper-91/70" />
          </li>
        ))}
      </ol>
    </section>
  );
}

async function SearchResults({
  params,
  partyEnumeration,
}: {
  params: CautaSearchParams;
  partyEnumeration: PartyEnumerationRow[];
}) {
  const speakerPartyRaw = params.partySlug
    ? dePartySlugs([params.partySlug], partyEnumeration)
    : undefined;
  const result = await searchSpeeches({
    q: params.q || undefined,
    page: params.page,
    pageSize: PAGE_SIZE,
    rankFusion: "rrf",
    speakerPersonId: params.speakerSlug || undefined,
    chamber: params.chamber ?? undefined,
    years: params.years.length > 0 ? params.years : undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    speakerPartyRaw,
    speechSizes: params.speechSizes.length > 0 ? params.speechSizes : undefined,
    isSubstantive: !params.includeProcedural,
    sort: params.sort,
    hawkinsScores: params.hawkinsScores.length > 0 ? params.hawkinsScores : undefined,
    vpartyScores: params.vpartyScores.length > 0 ? params.vpartyScores : undefined,
    dqiLevelMin: params.dqiLevelMin ?? undefined,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const safePage = Math.min(params.page, totalPages);
  const mode: "hybrid" | "bm25" = result.mode === "rrf" ? "hybrid" : "bm25";
  const performed: SearchPerformedProps = {
    query_length: params.q.length,
    query_word_count: params.q.trim() ? params.q.trim().split(/\s+/).length : 0,
    has_diacritics: hasDiacritics(params.q),
    filter_count: countFilterDimensions(params),
    filter_dimensions: listFilterDimensions(params),
    year_count: params.years.length,
    sort: sortToProp(params.sort),
    result_count: result.total,
    mode,
    took_ms: result.tookMs,
    page: safePage,
  };

  return (
    <SearchTracker performed={performed} resultMeta={{ page: safePage, mode }}>
      <section aria-labelledby="rezultate" className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="rezultate" className="label-mono text-ink-30">
            {result.total > 0
              ? `${formatCount(result.total)} ${result.total === 1 ? "rezultat" : "rezultate"}`
              : "Niciun rezultat"}
          </h2>
          <p
            className="label-mono text-ink-45"
            data-tabular-nums=""
            title={
              result.mode === "rrf" ? "Hibrid: BM25 + kNN (BGE-M3) cu fuziune RRF" : "Doar BM25"
            }
          >
            <span className="text-ink-30">{result.mode === "rrf" ? "Hibrid" : "BM25"}</span> ·{" "}
            {result.tookMs} ms
          </p>
        </div>

        {result.hits.length === 0 ? (
          <NoResults params={params} />
        ) : (
          <>
            <ol className="mt-6 divide-y divide-border border-y border-border">
              {result.hits.map((hit, idx) => (
                <SpeechHit
                  key={hit.record_id}
                  hit={hit}
                  snippet={result.highlights?.[hit.record_id]}
                  position={(safePage - 1) * PAGE_SIZE + idx + 1}
                />
              ))}
            </ol>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageHref={(p) => buildCautaHref(params, { page: p })}
            />
          </>
        )}
      </section>
    </SearchTracker>
  );
}

function countFilterDimensions(p: CautaSearchParams): number {
  return listFilterDimensions(p).length;
}

function listFilterDimensions(p: CautaSearchParams): SearchPerformedProps["filter_dimensions"] {
  const out: SearchPerformedProps["filter_dimensions"] = [];
  if (p.years.length > 0) out.push("year");
  if (p.dateFrom) out.push("date_from");
  if (p.dateTo) out.push("date_to");
  if (p.chamber) out.push("chamber");
  if (p.speakerSlug) out.push("speaker");
  if (p.partySlug) out.push("party");
  if (p.speechSizes.length > 0) out.push("length");
  if (p.includeProcedural) out.push("procedural");
  return out;
}

function sortToProp(s: SortSlug): SearchPerformedProps["sort"] {
  if (s === "date-desc") return "date_desc";
  if (s === "date-asc") return "date_asc";
  return "relevance";
}

function SpeechHit({
  hit,
  snippet,
  position,
}: {
  hit: MoSpeech;
  snippet?: string;
  position: number;
}) {
  const sessionDate = formatDate(hit.session_date);
  const speaker = hit.speaker.name_search || hit.speaker.name_raw;
  const fallbackText = hit.text ? excerpt(hit.text, 220) : null;
  const wordCount = speechWordCount(hit.text);
  const parsed = parseDocumentId(hit.document_id);
  const speechPosition = hit.position_in_document ?? hit.position_in_agenda;
  const docHref = parsed
    ? `/mo/${parsed.year}/${parsed.part}/${parsed.issue}#discurs-${speechPosition}`
    : null;
  // Canonical speech URL minted upstream and stored on every `mo-speeches`
  // record. Falls back to the in-doc anchor when slug is missing (rare —
  // upstream extractor mints `slug` for every speech) so the row stays
  // clickable in transitional states.
  const discursHref = hit.url_path || (hit.slug ? `/discurs/${hit.slug}` : null);
  const personSlug = hit.speaker.person_id;
  // Speaker subtitle — role + party-at-time, both upstream-populated when the
  // linker resolves them. Surfacing them helps a journalist tell "Florin
  // Iordache, ministru" apart from "Florin Iordache, deputat" at a glance.
  const speakerMeta = [hit.speaker.role, hit.speaker.party_group_at_time].filter((p): p is string =>
    Boolean(p),
  );
  // Top metadata strip: chamber + legislature on the left in label-mono;
  // session date is pulled to its own slot on the right (next to the length
  // meter) so the date reads as a primary scan target rather than vanishing
  // mid-string. Per DESIGN.md "Numerals-Are-Mono Rule", the date is set in
  // tabular mono.
  const chamberMeta = [hit.chamber, hit.legislature ? `legislatura ${hit.legislature}` : null]
    .filter(Boolean)
    .join(" · ");
  const hasDiscourseMarkers = Boolean(hit.enrichments?.discourse);
  return (
    <li
      className="px-1 py-6"
      data-result-position={position}
      data-result-kind="speech"
      data-result-has-speaker={personSlug ? "1" : "0"}
      data-result-has-discourse={hasDiscourseMarkers ? "1" : "0"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        {chamberMeta ? <p className="label-mono text-ink-45">{chamberMeta}</p> : <span />}
        <div className="flex items-baseline gap-4">
          {sessionDate ? (
            <time
              className="font-mono-meta text-xs text-ink-30"
              dateTime={hit.session_date ?? undefined}
            >
              {sessionDate}
            </time>
          ) : null}
          <SpeechLengthMeter wordCount={wordCount} />
        </div>
      </div>
      <p className="mt-3 text-base font-semibold leading-snug text-ink-16">
        {personSlug ? (
          <Link
            href={`/politicieni/${personSlug}`}
            className="underline decoration-paper-91 underline-offset-4 transition-colors hover:decoration-ink-30 hover:text-ink-30"
          >
            {speaker}
          </Link>
        ) : (
          speaker
        )}
      </p>
      {speakerMeta.length > 0 ? (
        <p className="mt-1 label-mono text-ink-45">{speakerMeta.join(" · ")}</p>
      ) : null}
      {hit.agenda_title ? (
        // Agenda title is the debate topic, not the speech itself — render
        // with a label-mono eyebrow per DESIGN.md "section affordances" rule.
        // Long parliamentary titles run six lines unchecked, so clamp to three.
        <div className="mt-4">
          <p className="label-mono text-ink-45">Pe ordinea de zi</p>
          <p className="mt-1 line-clamp-3 max-w-prose text-sm leading-snug text-ink-30">
            {hit.agenda_title}
          </p>
        </div>
      ) : null}
      {snippet ? (
        <p
          className="mt-4 max-w-prose text-base leading-relaxed text-ink-16"
          // eslint-disable-next-line react/no-danger -- ES `highlight` returns
          // pre-sanitized text wrapped in our own `<mark>` tags. The query
          // string is not echoed back; only the matched fragments are.
          dangerouslySetInnerHTML={{ __html: snippet }}
        />
      ) : fallbackText ? (
        <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-16">{fallbackText}</p>
      ) : null}
      {discursHref || docHref ? (
        <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {discursHref ? (
            <Link
              href={discursHref}
              className="label-mono text-ink-16 transition-colors hover:text-ink-30"
            >
              Citește discursul →
            </Link>
          ) : null}
          {discursHref && docHref ? (
            <span aria-hidden="true" className="label-mono text-ink-45">
              ·
            </span>
          ) : null}
          {docHref ? (
            <Link
              href={docHref}
              className="label-mono text-ink-45 transition-colors hover:text-ink-30"
            >
              Vezi în context →
            </Link>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

function parseDocumentId(id: string): { year: string; part: string; issue: string } | null {
  const m = id.match(/^mo:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { year: m[1], part: m[2], issue: m[3] };
}

function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

function NoResults({ params }: { params: CautaSearchParams }) {
  return (
    <div className="mt-6 border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm leading-relaxed text-ink-30">
        {params.q
          ? `Nu am găsit niciun discurs care să corespundă căutării „${params.q}”.`
          : "Niciun discurs nu corespunde filtrelor selectate."}{" "}
        Încercați să eliminați filtrele sau să folosiți cuvinte mai generale.
      </p>
    </div>
  );
}

function EmptyQuery() {
  return (
    <div className="mt-10 max-w-prose text-sm leading-relaxed text-ink-30">
      <p>
        Tastați un cuvânt-cheie, numele unui politician sau o referință legislativă în câmpul de mai
        sus.
      </p>
      <p className="mt-3 text-ink-45">
        Exemple: <em>educație</em>, <em>Codul muncii</em>, <em>Iohannis</em>,{" "}
        <em>Legea 100/2016</em>.
      </p>
    </div>
  );
}
