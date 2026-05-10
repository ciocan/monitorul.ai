import type { Metadata } from "next";
import Link from "next/link";

import { NotFoundViewedTracker } from "@/components/analytics/page-trackers";
import { SiteSearch } from "@/components/site-search";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pagină neidentificată",
  description:
    "Adresa solicitată nu corespunde unei intrări din arhivă. Căutați un discurs, un politician sau o sesiune.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-20">
      <NotFoundViewedTracker kind="global" />
      <p className="label-mono text-ink-45">Eroare 404</p>
      <h1 className="font-display mt-3 text-3xl text-ink-16 sm:text-4xl">Pagină neidentificată</h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
        Adresa solicitată nu corespunde unei intrări din arhivă. Permalink-urile rămân stabile odată
        ce o înregistrare este publicată — dacă ați ajuns aici dintr-o citare mai veche, încercați
        căutarea de mai jos sau accesați direct unul dintre punctele de intrare.
      </p>

      <div className="mt-8">
        <SiteSearch size="lg" />
      </div>

      <nav aria-labelledby="puncte-intrare" className="mt-10 border-t border-border pt-8">
        <h2 id="puncte-intrare" className="label-mono text-ink-30">
          Puncte de intrare
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          <EntryLink href="/mo" label="Sesiuni" />
          <EntryLink href="/politicieni" label="Politicieni" />
          <EntryLink href="/comisii" label="Comisii" />
        </ul>
      </nav>

      <div className="mt-10">
        <Button asChild variant="outline" size="lg" className="label-mono">
          <Link href="/">Pagina principală</Link>
        </Button>
      </div>
    </div>
  );
}

function EntryLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="font-display block text-xl text-ink-16 underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    </li>
  );
}
