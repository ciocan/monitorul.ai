import Link from "next/link";

import { cn } from "@/lib/utils";

// Methodology + model disclaimer rendered verbatim per
// `monitorul/docs/canonical-queries.md`. The page-level slot at the bottom
// of /statistici. This block is also reused on every aggregating surface in
// the discourse-UI rollout.

export interface MethodologyBlockProps {
  producerLabel?: string | null;
  className?: string;
}

export function MethodologyBlock({ producerLabel, className }: MethodologyBlockProps) {
  const codedBy = producerLabel ?? "google/gemini-3.1-flash-lite";
  return (
    <aside
      className={cn("border-t border-paper-91 pt-6 text-sm leading-relaxed text-ink-30", className)}
      aria-labelledby="metodologie"
    >
      <h2 id="metodologie" className="label-mono mb-3 text-ink-30">
        Metodologie & disclaimer
      </h2>
      <p className="max-w-prose">
        Aceste statistici sunt derivate din analiza automată de discurs sub patru cadre publicate
        (Hawkins populism, V-Party anti-pluralism, DQI Steiner-Bächtiger, atribuire de voce). Sunt
        codări per speech-act, nu per persoană. Cifrele descriu ce s-a spus și cum, nu cine este
        vorbitorul.
      </p>
      <p className="mt-3 max-w-prose">
        Codările au fost produse de <span className="font-mono-meta">{codedBy}</span>. Recodarea sub
        un alt model, prompt sau cadru poate genera rezultate diferite. Acoperire: speech-uri
        substanțiale începând cu <span className="font-mono-meta">martie 2023</span>; restul arhivei
        rămâne neanalizat.
      </p>
      <p className="mt-3 max-w-prose">
        Codările nu au fost încă validate față de acordul inter-codator (κ); proiectul plănuiește
        publicarea statisticilor κ într-o versiune ulterioară. Tratează această pagină ca explorare
        reproducibilă, nu ca fapt stabilit. Marcherii, evidența și raționamentul fiecărei codări
        sunt vizibili pe pagina fiecărui discurs.
      </p>
      <p className="mt-3 max-w-prose">
        <Link
          href="/despre#discurs-analiza"
          className="underline decoration-paper-91 underline-offset-2 hover:text-ink-30 hover:decoration-ink-30"
        >
          Detalii complete despre metodologie →
        </Link>
      </p>
    </aside>
  );
}
