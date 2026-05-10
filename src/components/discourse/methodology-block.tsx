import Link from "next/link";

import { cn } from "@/lib/utils";

// Methodology + model disclaimer rendered verbatim per
// `monitorul/docs/canonical-queries.md`. The page-level slot at the bottom
// of /statistici. This block is also reused on every aggregating surface in
// the discourse-UI rollout.

export interface MethodologyBlockProps {
  producerLabel?: string | null;
  showRankingsNote?: boolean;
  className?: string;
}

export function MethodologyBlock({
  producerLabel,
  showRankingsNote = false,
  className,
}: MethodologyBlockProps) {
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
        substanțiale începând cu <span className="font-mono-meta">2020</span>; restul arhivei rămâne
        neanalizat.
      </p>
      <p className="mt-3 max-w-prose">
        Codările nu au fost încă validate față de acordul inter-codator (κ); proiectul plănuiește
        publicarea statisticilor κ într-o versiune ulterioară. Tratează această pagină ca explorare
        reproducibilă, nu ca fapt stabilit. Marcherii, evidența și raționamentul fiecărei codări
        sunt vizibili pe pagina fiecărui discurs.
      </p>
      {showRankingsNote && (
        <>
          <p className="mt-3 max-w-prose">
            <span className="label-mono mr-2 text-ink-16">Cum sunt ordonați politicienii</span>
            Clasamentul este sortat după <em>numărul absolut</em> de discursuri marcate (H ≥ 1
            pentru Hawkins, V ≥ 1 pentru V-Party, DQI ≥ 2 pentru calitate deliberativă), nu după
            rata observată. Concret: un politician cu 576 discursuri marcate din 582 (rată 99%) urcă
            mai sus decât unul cu 538 marcate din 538 (rată 100%) — primul a livrat de mai multe ori
            același tip de intervenție, chiar dacă procentul e ușor mai mic. Coloana procentuală
            arată rata observată; ultima coloană este totalul discursurilor analizate. Politicienii
            cu sub 5 discursuri analizate sunt excluși — nu sunt suficiente date pentru a-i compara
            onest. Sortarea după rată sau după marginea inferioară Wilson va veni ca opțiune
            separată într-o versiune ulterioară.
          </p>
          <p className="mt-3 max-w-prose">
            <span className="label-mono mr-2 text-ink-16">Despre bara din clasamente</span>
            Lângă fiecare politician apare o bandă orizontală — un{" "}
            <em>interval de încredere de 95%</em> (Wilson). Linia verticală din mijloc este rata
            observată; banda din jur arată plaja în care s-ar afla rata reală dacă am avea date
            complete. Cu puține discursuri analizate banda este largă (rata poate fi întâmplare); cu
            multe discursuri banda devine îngustă (rata e probabil aproape de cea reală). Așa, un
            politician cu 3 din 3 discursuri marcate nu sare automat în top — așteptăm mai multe
            date înainte să fie sigur.
          </p>
        </>
      )}
      <p className="mt-3 max-w-prose">
        <Link
          href="/despre/discurs"
          className="underline decoration-paper-91 underline-offset-2 hover:text-ink-30 hover:decoration-ink-30"
        >
          Detalii complete despre metodologie →
        </Link>
      </p>
    </aside>
  );
}
