import Link from "next/link";

import { NotFoundViewedTracker } from "@/components/analytics/page-trackers";
import { Button } from "@/components/ui/button";

export default function CommitteeNotFound() {
  return (
    <div className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-20">
      <NotFoundViewedTracker kind="committee" />
      <p className="label-mono text-ink-45">Eroare 404</p>
      <h1 className="font-display mt-3 text-3xl text-ink-16">Comisie neidentificată</h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
        Identificatorul solicitat nu corespunde niciunei comisii cu ședințe indexate. Registrul este
        derivat din ședințele publicate în Monitorul Oficial — comisiile fără activitate
        înregistrată nu apar aici. Dacă ați ajuns dintr-o citare, comisia este probabil prezentă sub
        un alt identificator pe măsură ce reindexarea progresează.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline" size="lg" className="label-mono">
          <Link href="/comisii">Toate comisiile</Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="label-mono">
          <Link href="/">Pagina principală</Link>
        </Button>
      </div>
    </div>
  );
}
