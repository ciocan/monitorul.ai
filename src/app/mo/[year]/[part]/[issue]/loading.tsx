// Skeleton mirrors `src/app/mo/[year]/[part]/[issue]/page.tsx`. The document
// page runs getDocument + listDocumentChildren (up to 500 grains across six
// indices) — easily a 300-700ms hop. Without this fallback the click waits
// on the previous page until the body is ready.

export default function Loading() {
  return (
    <article
      className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Se încarcă documentul…</p>

      <div className="h-3 w-80 animate-pulse bg-paper-91/70" aria-hidden="true" />

      <header className="mt-6 border-b border-border pb-8" aria-hidden="true">
        <div className="h-10 w-1/2 max-w-md animate-pulse bg-paper-91 sm:h-12" />
        <div className="mt-4 h-4 w-full max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-2 h-4 w-4/5 max-w-prose animate-pulse bg-paper-91/70" />
        <dl className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="h-3 w-16 animate-pulse bg-paper-91/70" />
              <div className="mt-2 h-3 w-24 animate-pulse bg-paper-91" />
            </div>
          ))}
        </dl>
      </header>

      <section className="mt-10" aria-hidden="true">
        <div className="mb-4 h-3 w-16 animate-pulse bg-paper-91/70" />
        <ol className="divide-y divide-border border-y border-border">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="px-1 py-4">
              <div className="flex items-baseline gap-4">
                <div className="h-3 w-6 shrink-0 animate-pulse bg-paper-91/70" />
                <div className="h-4 w-3/4 max-w-2xl animate-pulse bg-paper-91" />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-hidden="true">
        <div className="mb-6 h-3 w-24 animate-pulse bg-paper-91/70" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="mb-8">
            <div className="h-3 w-40 animate-pulse bg-paper-91/70" />
            <div className="mt-3 h-4 w-2/5 animate-pulse bg-paper-91" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full max-w-prose animate-pulse bg-paper-91/70" />
              <div className="h-3 w-11/12 max-w-prose animate-pulse bg-paper-91/70" />
              <div className="h-3 w-4/5 max-w-prose animate-pulse bg-paper-91/70" />
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}
