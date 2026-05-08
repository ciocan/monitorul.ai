// Skeleton mirrors `src/app/politicieni/[slug]/page.tsx`. Person profiles
// run personPage(), which fans out across stats, year-counts, day-buckets and
// the speeches list — the heaviest profile read in the layer.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Se încarcă profilul politicianului…</p>

      <div className="h-3 w-64 animate-pulse bg-paper-91/70" aria-hidden="true" />

      <header className="mt-6 border-b border-border pb-8" aria-hidden="true">
        <div className="h-10 w-3/5 max-w-lg animate-pulse bg-paper-91 sm:h-14" />
        <div className="mt-4 h-3 w-2/3 max-w-md animate-pulse bg-paper-91/70" />
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="h-3 w-20 animate-pulse bg-paper-91/70" />
              <div className="mt-2 h-4 w-12 animate-pulse bg-paper-91" />
            </div>
          ))}
        </div>
      </header>

      <section className="mt-10" aria-hidden="true">
        <div className="mb-4 h-3 w-32 animate-pulse bg-paper-91/70" />
        <div className="border-y border-border py-4">
          <div className="flex items-end gap-[3px]" style={{ minHeight: "78px" }}>
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="animate-pulse bg-paper-91"
                  style={{
                    width: "12px",
                    height: `${8 + ((i * 23) % 50)}px`,
                  }}
                />
                <div className="mt-2 h-2 w-3 animate-pulse bg-paper-91/70" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12" aria-hidden="true">
        <div className="mb-4 h-3 w-44 animate-pulse bg-paper-91/70" />
        <div className="grid grid-cols-[repeat(53,minmax(0,1fr))] gap-[2px]">
          {Array.from({ length: 53 * 7 }, (_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse bg-paper-91/60"
              style={{ animationDelay: `${(i % 12) * 50}ms` }}
            />
          ))}
        </div>
      </section>

      <section className="mt-12" aria-hidden="true">
        <div className="mb-4 flex items-baseline justify-between gap-x-6">
          <div className="h-3 w-40 animate-pulse bg-paper-91/70" />
          <div className="h-3 w-16 animate-pulse bg-paper-91/70" />
        </div>
        <ol className="divide-y divide-border border-y border-border">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="px-1 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <div className="h-3 w-56 animate-pulse bg-paper-91/70" />
                <div className="h-3 w-20 animate-pulse bg-paper-91/70" />
              </div>
              <div className="mt-3 h-3 w-11/12 max-w-prose animate-pulse bg-paper-91/70" />
              <div className="mt-2 h-3 w-3/4 max-w-prose animate-pulse bg-paper-91/70" />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
