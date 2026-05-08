"use client";

import Link from "next/link";
import { useEffect } from "react";

import { SiteSearch } from "@/components/site-search";
import { Button } from "@/components/ui/button";

export default function CautaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cauta:error]", error);
  }, [error]);

  const isTimeout = /timeout|timed out|ETIMEDOUT/i.test(error.message);

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-20">
      <p className="label-mono text-alert-civic">
        {isTimeout ? "Căutare prea lentă" : "Eroare la căutare"}
      </p>
      <h1 className="font-display mt-3 text-3xl text-ink-16 sm:text-4xl">
        {isTimeout
          ? "Serviciul de căutare a răspuns prea încet"
          : "Căutarea nu a putut fi finalizată"}
      </h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
        {isTimeout ? (
          <>
            Indexul a depășit limita de timp pentru această cerere. Se întâmplă uneori la încărcare
            ridicată sau la interogări foarte largi. Reîncearcă în câteva secunde sau restrânge
            căutarea cu un filtru (an, cameră, vorbitor).
          </>
        ) : (
          <>
            A apărut o problemă temporară la procesarea cererii. Reîncearcă într-o clipă sau
            pornește o căutare nouă.
          </>
        )}
      </p>

      <div className="mt-8 max-w-2xl">
        <SiteSearch size="lg" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset} size="lg" className="label-mono">
          Reîncearcă
        </Button>
        <Button asChild variant="outline" size="lg" className="label-mono">
          <Link href="/cauta">Resetează căutarea</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="label-mono mt-10 text-xs text-ink-45">
          Cod referință: <span data-tabular-nums="">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
