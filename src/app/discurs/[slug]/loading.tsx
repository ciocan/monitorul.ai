// Skeleton mirrors `src/app/discurs/[slug]/page.tsx`. The speech page makes
// one ES round-trip (slug term, optional wildcard fallback) so this is the
// fastest profile read in the layer — keep the skeleton minimal.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Se încarcă discursul…</p>

      <div className="h-3 w-72 animate-pulse bg-paper-91/70" aria-hidden="true" />

      <header className="mt-6 border-b border-border pb-8" aria-hidden="true">
        <div className="h-3 w-40 animate-pulse bg-paper-91/70" />
        <div className="mt-3 h-10 w-2/3 max-w-lg animate-pulse bg-paper-91 sm:h-14" />
        <div className="mt-4 h-3 w-1/2 max-w-md animate-pulse bg-paper-91/70" />
        <div className="mt-5 h-3 w-3/4 max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-2 h-3 w-2/3 max-w-prose animate-pulse bg-paper-91/70" />
      </header>

      <section className="mt-10" aria-hidden="true">
        <div className="mb-6 h-3 w-20 animate-pulse bg-paper-91/70" />
        <div className="max-w-prose space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse bg-paper-91/70"
              style={{ width: `${70 + ((i * 17) % 25)}%` }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
