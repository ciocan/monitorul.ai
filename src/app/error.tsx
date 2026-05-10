"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app:error]", error);
  }, [error]);

  // Capacity-class signals: ES timeout, circuit breaker, queue rejection, or
  // upstream 429. When any of these surfaces, route the user to /sustine so
  // the cause (operationally finite infrastructure) is named honestly. For
  // generic crashes (code bugs, missing data) we stay quiet — the support
  // page is not a catch-all consolation prize.
  const isCapacity =
    /timeout|timed out|ETIMEDOUT|circuit_breaking|es_rejected|rate.?limit|429|too many requests/i.test(
      error.message,
    );

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-20">
      <p className="label-mono text-alert-civic">Eroare</p>
      <h1 className="font-display mt-3 text-3xl text-ink-16 sm:text-4xl">
        Cererea nu a putut fi procesată
      </h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
        A apărut o problemă la afișarea acestei pagini. Adresele permalink rămân stabile — pagina
        este probabil în continuare disponibilă, dar serviciul a răspuns încet sau a întâmpinat o
        eroare temporară. Încercați din nou într-o clipă.
      </p>

      {isCapacity ? (
        <p className="label-mono mt-4 text-xs text-ink-45">
          Indexul rulează pe capacitate finită, finanțată din contribuții.{" "}
          <Link
            href="/sustine"
            className="text-ink-30 underline underline-offset-4 hover:text-ink-16"
          >
            Cum este susținut proiectul →
          </Link>
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset} size="lg" className="label-mono">
          Reîncearcă
        </Button>
        <Button asChild variant="outline" size="lg" className="label-mono">
          <Link href="/">Pagina principală</Link>
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
