import Link from "next/link";

import { NotFoundViewedTracker } from "@/components/analytics/page-trackers";
import { Button } from "@/components/ui/button";

export default function SpeechNotFound() {
  return (
    <div className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-20">
      <NotFoundViewedTracker kind="speech" />
      <p className="label-mono text-ink-45">Eroare 404</p>
      <h1 className="font-display mt-3 text-3xl text-ink-16">Discurs neidentificat</h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
        Identificatorul solicitat nu există în arhiva discursurilor sau nu a fost încă indexat.
        Slugurile sunt persistate o singură dată; dacă ați urmat o citare, este posibil ca
        intervenția să fi fost retrasă upstream sau ca extractorul să nu fi marcat încă această
        înregistrare ca substanțială.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline" size="lg" className="label-mono">
          <Link href="/cauta">Caută în discursuri</Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="label-mono">
          <Link href="/">Pagina principală</Link>
        </Button>
      </div>
    </div>
  );
}
