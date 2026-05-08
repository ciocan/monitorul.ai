// Skeleton mirrors `src/app/comisii/[committee_id]/page.tsx`. Committee
// profile reads committeePage() which fans out across header meta, year
// counts and the meeting list for the selected year.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Se încarcă profilul comisiei…</p>

      <div className="h-3 w-64 animate-pulse bg-paper-91/70" aria-hidden="true" />

      <header className="mt-6 border-b border-border pb-8" aria-hidden="true">
        <div className="h-10 w-3/4 max-w-2xl animate-pulse bg-paper-91 sm:h-14" />
        <div className="mt-4 h-3 w-1/3 max-w-sm animate-pulse bg-paper-91/70" />
        <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <div className="h-3 w-24 animate-pulse bg-paper-91/70" />
              <div className="mt-2 h-4 w-16 animate-pulse bg-paper-91" />
            </div>
          ))}
        </div>
      </header>

      <section className="mt-10" aria-hidden="true">
        <div className="mb-4 h-3 w-12 animate-pulse bg-paper-91/70" />
        <div className="border-y border-border py-4">
          <div className="flex items-end gap-[3px]" style={{ minHeight: "78px" }}>
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="animate-pulse bg-paper-91"
                  style={{
                    width: "12px",
                    height: `${10 + ((i * 17) % 48)}px`,
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
        <ol className="divide-y divide-border border-y border-border">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="px-1 py-5">
              <div className="flex items-baseline gap-4">
                <div className="h-3 w-24 shrink-0 animate-pulse bg-paper-91/70" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-4/5 max-w-xl animate-pulse bg-paper-91" />
                  <div className="mt-3 h-2 w-1/2 max-w-sm animate-pulse bg-paper-91/70" />
                </div>
                <div className="hidden h-3 w-16 shrink-0 animate-pulse bg-paper-91/70 sm:block" />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
