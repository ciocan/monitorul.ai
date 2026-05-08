// Skeleton mirrors `src/app/politicieni/page.tsx`. The politicians index runs
// three ES queries in sequence/parallel (year counts, top-100 buckets,
// persons mget); without this fallback the click waits ~300-500ms on the
// previous page.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Se încarcă registrul politicienilor…</p>

      <div className="h-3 w-80 animate-pulse bg-paper-91/70" aria-hidden="true" />

      <header className="mt-6 border-b border-border pb-8" aria-hidden="true">
        <div className="h-10 w-52 animate-pulse bg-paper-91 sm:h-12 sm:w-64" />
        <div className="mt-5 h-4 w-full max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-2 h-4 w-11/12 max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-2 h-4 w-3/4 max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-6 h-3 w-72 animate-pulse bg-paper-91/70" />
      </header>

      <section className="mt-10" aria-hidden="true">
        <div className="mb-4 h-3 w-12 animate-pulse bg-paper-91/70" />
        <div className="border-y border-border py-4">
          <div className="flex items-end gap-[3px]" style={{ minHeight: "78px" }}>
            {Array.from({ length: 26 }, (_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="animate-pulse bg-paper-91"
                  style={{
                    width: "12px",
                    height: `${10 + ((i * 13) % 50)}px`,
                  }}
                />
                <div className="mt-2 h-2 w-3 animate-pulse bg-paper-91/70" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12" aria-hidden="true">
        <div className="mb-4 flex items-baseline justify-between gap-x-6">
          <div className="h-3 w-56 animate-pulse bg-paper-91/70" />
          <div className="h-3 w-12 animate-pulse bg-paper-91/70" />
        </div>
        <div className="-mt-1 mb-4 h-3 w-72 animate-pulse bg-paper-91/70" />
        <ol className="divide-y divide-border border-y border-border">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="px-1 py-5">
              <div className="flex items-baseline gap-4">
                <div className="h-3 w-6 shrink-0 animate-pulse bg-paper-91/70" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-1/2 max-w-md animate-pulse bg-paper-91" />
                  <div className="mt-3 h-2 w-2/5 max-w-sm animate-pulse bg-paper-91/70" />
                </div>
                <div className="h-3 w-10 shrink-0 animate-pulse bg-paper-91/70" />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
