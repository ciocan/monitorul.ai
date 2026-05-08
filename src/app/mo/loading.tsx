// Skeleton mirrors `src/app/mo/page.tsx` so layout stays put while the ES
// fan-out (sessionsIndex → year-counts + sessions-for-year) resolves. With no
// loading.tsx Next.js 16 won't prefetch the dynamic `?year=…` shape and the
// browser sticks on the previous page until the server finishes.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Se încarcă registrul sesiunilor…</p>

      <div className="h-3 w-72 animate-pulse bg-paper-91/70" aria-hidden="true" />

      <header className="mt-6 border-b border-border pb-8" aria-hidden="true">
        <div className="h-10 w-44 animate-pulse bg-paper-91 sm:h-12 sm:w-56" />
        <div className="mt-5 h-4 w-full max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-2 h-4 w-4/5 max-w-prose animate-pulse bg-paper-91/70" />
        <div className="mt-6 h-3 w-64 animate-pulse bg-paper-91/70" />
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
                    height: `${8 + ((i * 17) % 52)}px`,
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
          <div className="h-3 w-32 animate-pulse bg-paper-91/70" />
          <div className="h-3 w-20 animate-pulse bg-paper-91/70" />
        </div>
        <ol className="divide-y divide-border border-y border-border">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="px-1 py-5">
              <div className="flex items-baseline gap-4">
                <div className="h-3 w-24 shrink-0 animate-pulse bg-paper-91/70 sm:w-36" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-3/5 max-w-md animate-pulse bg-paper-91" />
                  <div className="mt-3 h-2 w-2/3 max-w-sm animate-pulse bg-paper-91/70" />
                </div>
                <div className="hidden h-3 w-14 shrink-0 animate-pulse bg-paper-91/70 sm:block" />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
