// /cauta has its own internal Suspense around the results, but the outer
// shell (party enumeration + speaker name resolve) is async too — clicking
// from the homepage to `/cauta?q=…` still waits ~150-300ms before the
// SearchResultsSkeleton can take over. This loading.tsx covers that gap.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Se încarcă căutarea…</p>

      <header className="border-b border-border pb-8" aria-hidden="true">
        <div className="h-3 w-20 animate-pulse bg-paper-91/70" />
        <div className="mt-3 h-9 w-2/3 max-w-xl animate-pulse bg-paper-91 sm:h-10" />
        <div className="mt-6 h-12 w-full max-w-3xl animate-pulse bg-paper-91/80" />
        <div className="mt-3 h-3 w-full max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-2 h-3 w-3/5 max-w-prose animate-pulse bg-paper-91/70" />
      </header>

      <section className="mt-10" aria-hidden="true">
        <div className="flex items-baseline justify-between gap-4">
          <div className="h-3 w-24 animate-pulse bg-paper-91/70" />
          <div className="h-3 w-20 animate-pulse bg-paper-91/70" />
        </div>
        <ol className="mt-6 divide-y divide-border border-y border-border">
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
    </div>
  );
}
