import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DocumentNotFound() {
  return (
    <div className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-20">
      <p className="label-mono text-ink-45">Eroare 404</p>
      <h1 className="font-display mt-3 text-3xl text-ink-16">Document neidentificat</h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
        Numărul solicitat al Monitorului Oficial nu există în arhivă sau nu a fost încă indexat.
        Permalink-urile rămân stabile odată ce un număr este publicat — dacă ați ajuns aici dintr-o
        citare, înregistrarea este probabil disponibilă sub un alt număr.
      </p>
      <div className="mt-6">
        <Button asChild variant="outline" size="lg" className="label-mono">
          <Link href="/">Pagina principală</Link>
        </Button>
      </div>
    </div>
  );
}
