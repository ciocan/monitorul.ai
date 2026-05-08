import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Pagination } from "@/components/pagination";
import { SiteSearch } from "@/components/site-search";
import { SpeechLengthMeter } from "@/components/speech-length-meter";
import { formatCount, formatDate, speechWordCount } from "@/lib/format";
import { searchSpeeches } from "@/lib/search";
import type { MoSpeech } from "@/lib/types";

// Per docs/elasticsearch-indexing.md §Q7: search-results pages are
// `noindex, follow`. They're not citable archive content; the records they
// link to are. Dynamic per-query render — no ISR.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pageNumber(raw: string | string[] | undefined): number {
  const n = Number.parseInt(firstParam(raw), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 1000);
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const title = q ? `Căutare: ${q}` : "Caută în arhivă";
  return {
    title,
    description: q
      ? `Rezultate pentru „${q}” în arhiva Monitorului Oficial.`
      : "Caută discursuri, voturi, interpelări, politicieni și ședințe în arhiva publică.",
    robots: { index: false, follow: true },
    alternates: { canonical: "/cauta" },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const page = pageNumber(sp.page);

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <header className="border-b border-border pb-8">
        <p className="label-mono text-ink-30">Căutare</p>
        <h1 className="font-display mt-2 text-3xl text-ink-16 sm:text-4xl">
          {q ? <>Rezultate pentru „{q}”</> : "Caută în arhivă"}
        </h1>
        <div className="mt-6 max-w-3xl">
          <SiteSearch size="lg" defaultValue={q} autoFocus={!q} />
        </div>
        <p className="mt-3 max-w-prose text-sm text-ink-45">
          Căutarea acoperă discursurile substanțiale (lungime ≥ 100 caractere) din stenograme.
          Voturile, interpelările, întrebările și ședințele de comisie vor fi adăugate în paginile
          de căutare următoare.
        </p>
      </header>

      {q ? (
        <Suspense key={`${q}|${page}`} fallback={<SearchResultsSkeleton />}>
          <SearchResults q={q} page={page} />
        </Suspense>
      ) : (
        <EmptyQuery />
      )}
    </div>
  );
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

async function SearchResults({ q, page }: { q: string; page: number }) {
  const result = await searchSpeeches({ q, page, pageSize: PAGE_SIZE, rankFusion: "rrf" });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const safePage = Math.min(page, totalPages);

  return (
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
          title={result.mode === "rrf" ? "Hibrid: BM25 + kNN (BGE-M3) cu fuziune RRF" : "Doar BM25"}
        >
          <span className="text-ink-30">{result.mode === "rrf" ? "Hibrid" : "BM25"}</span> ·{" "}
          {result.tookMs} ms
        </p>
      </div>

      {result.hits.length === 0 ? (
        <NoResults q={q} />
      ) : (
        <>
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {result.hits.map((hit) => (
              <SpeechHit
                key={hit.record_id}
                hit={hit}
                snippet={result.highlights?.[hit.record_id]}
              />
            ))}
          </ol>
          <Pagination page={safePage} totalPages={totalPages} pageHref={(p) => hrefFor(q, p)} />
        </>
      )}
    </section>
  );
}

function SpeechHit({ hit, snippet }: { hit: MoSpeech; snippet?: string }) {
  const sessionDate = formatDate(hit.session_date);
  const speaker = hit.speaker.name_search || hit.speaker.name_raw;
  const fallbackText = hit.text ? excerpt(hit.text, 220) : null;
  const wordCount = speechWordCount(hit.text);
  // Speech URL ships in a later phase; until then, link to the parent document
  // page with a `#discurs-<position>` fragment that matches the inline anchor
  // rendered by the document page (`target:` highlights it on landing).
  const parsed = parseDocumentId(hit.document_id);
  const speechPosition = hit.position_in_document ?? hit.position_in_agenda;
  const docHref = parsed
    ? `/mo/${parsed.year}/${parsed.part}/${parsed.issue}#discurs-${speechPosition}`
    : "/";
  // Speaker→person link gate, same shape as the document-page speech blocks:
  // wrap in `<Link>` only when `speaker.person_id` is non-null. The id matches
  // the person record's slug 1:1 (minted upstream from the canonical name).
  const personSlug = hit.speaker.person_id;
  return (
    <li className="px-1 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="label-mono text-ink-45">
          {[hit.chamber, sessionDate, hit.legislature ? `legislatura ${hit.legislature}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <SpeechLengthMeter wordCount={wordCount} />
      </div>
      <p className="mt-2 text-base font-semibold leading-snug text-ink-16">
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
      {hit.agenda_title ? (
        <p className="mt-1 text-sm text-ink-30">
          <span className="text-ink-45">Pe ordinea de zi: </span>
          {hit.agenda_title}
        </p>
      ) : null}
      {snippet ? (
        <p
          className="mt-3 max-w-prose text-sm leading-relaxed text-ink-30"
          // eslint-disable-next-line react/no-danger -- ES `highlight` returns
          // pre-sanitized text wrapped in our own `<mark>` tags. The query
          // string is not echoed back; only the matched fragments are.
          dangerouslySetInnerHTML={{ __html: snippet }}
        />
      ) : fallbackText ? (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-30">{fallbackText}</p>
      ) : null}
      <p className="mt-3">
        <Link
          href={docHref}
          className="label-mono text-ink-45 underline decoration-paper-91 underline-offset-4 transition-colors hover:decoration-ink-30 hover:text-ink-30"
        >
          Vezi în context →
        </Link>
      </p>
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

function hrefFor(q: string, page: number): string {
  const params = new URLSearchParams({ q });
  if (page > 1) params.set("page", String(page));
  return `/cauta?${params.toString()}`;
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="mt-6 border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm leading-relaxed text-ink-30">
        Nu am găsit niciun discurs care să corespundă căutării „{q}”. Verificați ortografia,
        încercați cuvinte mai generale sau o singură expresie cheie.
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
