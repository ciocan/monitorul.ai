import Link from "next/link";

import { NotFoundViewedTracker } from "@/components/analytics/page-trackers";
import { Button } from "@/components/ui/button";

export default function PersonNotFound() {
  return (
    <div className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-20">
      <NotFoundViewedTracker kind="person" />
      <p className="label-mono text-ink-45">Eroare 404</p>
      <h1 className="font-display mt-3 text-3xl text-ink-16">Persoană neidentificată</h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
        Identificatorul solicitat nu există în registrul politicienilor sau nu a fost încă indexat.
        Legarea numelor din stenograme la registru este în desfășurare; o citare care a aterizat
        aici va deveni validă pe măsură ce reindexarea progresează.
      </p>
      <div className="mt-6">
        <Button asChild variant="outline" size="lg" className="label-mono">
          <Link href="/">Pagina principală</Link>
        </Button>
      </div>
    </div>
  );
}
