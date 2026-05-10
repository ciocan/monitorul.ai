import type { Metadata } from "next";
import Link from "next/link";

import { MethodologyViewedTracker } from "@/components/analytics/page-trackers";
import { TrackedExternalLink } from "@/components/analytics/tracked-link";
import { Dateline } from "@/components/dateline";
import { env } from "@/env";

// Methodology page split into two parts: Part I (plain Romanian, no jargon —
// for citizens, journalists, casual readers) and Part II (technical depth —
// for data journalists, researchers, developers). The footer's Metodologie
// column links into `#identitate` and `#corectii`, which live in Part I so a
// non-technical reader lands on the plain-language version first; deeper
// readers can jump to `#identitate-tehnic` / `#cautare-tehnic` from Part II.
// ISR 1h, JSON-LD `AboutPage`.
export const revalidate = 3600;

const TITLE = "Despre arhivă";
const DESCRIPTION =
  "Ce este monitorul.ai, de unde vin datele, de ce link-urile rămân stabile și unde poți semnala erori — întâi pe scurt, apoi cu detalii tehnice pentru cercetători și dezvoltatori.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/despre" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    locale: "ro_RO",
    url: "/despre",
  },
};

interface TocItem {
  id: string;
  label: string;
}

const TOC_PART_ONE: TocItem[] = [
  { id: "ce-este", label: "Ce este monitorul.ai" },
  { id: "de-unde", label: "De unde vin datele" },
  { id: "acoperire", label: "Ce găsești și ce nu găsești" },
  { id: "identitate", label: "De ce link-urile rămân stabile" },
  { id: "cautare", label: "Cum funcționează căutarea" },
  { id: "confidentialitate", label: "Ce stocăm despre tine" },
  { id: "corectii", label: "Cum semnalezi o eroare" },
  { id: "sursa", label: "Surse și licență" },
];

const TOC_PART_TWO: TocItem[] = [
  { id: "pipeline", label: "Pipeline-ul în opt pași" },
  { id: "identitate-tehnic", label: "Identitatea înregistrărilor" },
  { id: "cautare-tehnic", label: "Hibrid BM25 + kNN" },
  { id: "confidentialitate-tehnic", label: "Date personale și log" },
];

export default function DesprePage() {
  return (
    <article className="mx-auto w-full max-w-(--breakpoint-lg) px-6 py-12 sm:py-16">
      <DespreJsonLd />
      <MethodologyViewedTracker page="despre" />

      <Dateline parts={["Notă metodologică", "Monitorul.ai", "Arhivă publică"]} />

      <header className="mt-6 border-b border-border pb-10">
        <h1 className="font-display text-4xl leading-[1.05] text-ink-16 sm:text-5xl lg:text-6xl">
          {TITLE}
        </h1>
        <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-30">
          monitorul.ai este o arhivă publică și citabilă a stenogramelor parlamentare din România,
          extrase din <em>Monitorul Oficial al României, Partea a II-a</em>. Această notă explică ce
          găsești în arhivă, de unde vin datele, de ce link-urile rămân stabile și unde poți semnala
          erori — întâi pe scurt, apoi cu detalii tehnice pentru cititorii care vor să înțeleagă
          pipeline-ul, identitatea înregistrărilor și mecanismul de căutare.
        </p>
      </header>

      <nav aria-labelledby="cuprins" className="mt-10 border-b border-border pb-10">
        <h2 id="cuprins" className="label-mono text-ink-30">
          Cuprins
        </h2>
        <div className="mt-6 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          <TocColumn
            partLabel="Partea I"
            partTitle="Pentru toți cititorii"
            items={TOC_PART_ONE}
            startNumber={1}
          />
          <TocColumn
            partLabel="Partea a II-a"
            partTitle="Detalii tehnice"
            items={TOC_PART_TWO}
            startNumber={TOC_PART_ONE.length + 1}
          />
        </div>
      </nav>

      <PartHeader
        partLabel="Partea I"
        title="Pentru toți cititorii"
        subtitle="O privire de ansamblu, fără jargon. Dacă citești arhiva ca jurnalist, cetățean, studentă sau cercetător din afara domeniului tehnic, această parte îți este suficientă."
      />

      <Section id="ce-este" title="Ce este monitorul.ai">
        <p>
          Monitorul.ai este o copie căutabilă a stenogramelor parlamentare publicate oficial. Tot
          textul de pe site vine din <em>Monitorul Oficial al României, Partea a II-a</em> —
          registrul în care apar săptămânal ședințele de plen ale Camerei Deputaților, ale Senatului
          și ședințele comune, sintezele lucrărilor comisiilor parlamentare, interpelările,
          întrebările scrise și rapoartele instituțiilor care raportează în Parlament.
        </p>
        <p>
          Diferența față de PDF-ul oficial este că aici poți căuta într-un text — nu doar în titlul
          documentului — poți să vezi pe profilul unui politician toate intervențiile sale și poți
          trimite unei colege un link care va deschide aceeași intervenție și peste cinci ani.
          Stenogramele rămân așa cum au fost publicate; arhiva nu rezumă, nu reformulează și nu
          adaugă comentariu redacțional.
        </p>
        <p>
          Site-ul nu este o sursă oficială. Pentru documentul cu efect juridic consultați{" "}
          <TrackedExternalLink
            href="https://monitoruloficial.ro"
            event={{ destination: "monitoruloficial", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            monitoruloficial.ro
          </TrackedExternalLink>
          . Monitorul.ai este un strat de citare și descoperire peste documentele publice;
          autoritatea juridică rămâne la sursă.
        </p>
      </Section>

      <Section id="de-unde" title="De unde vin datele">
        <p>
          Datele sunt importate automat din PDF-urile publicate pe monitoruloficial.ro. Un program
          de prelucrare descarcă fiecare număr nou, citește textul stenogramelor, identifică ce
          intervenție aparține cui, ce vot a urmat după ce, ce raport a fost prezentat în care
          ședință, și pune totul într-o formă în care poți căuta.
        </p>
        <p>
          Importul nu adaugă nimic la conținut: nu rezumă, nu reformulează, nu interpretează.
          Stenograma rămâne așa cum a fost publicată; singura activitate este reorganizarea — ce era
          într-un PDF de o sută de pagini devine o listă de ședințe, fiecare cu ordinea de zi,
          intervențiile și voturile.
        </p>
        <p>
          Procesul tehnic, etapă cu etapă, este descris la{" "}
          <a href="#pipeline" className="underline underline-offset-4 hover:text-ink-16">
            Pipeline-ul în opt pași
          </a>
          .
        </p>
      </Section>

      <Section id="acoperire" title="Ce găsești și ce nu găsești">
        <p>
          Arhiva acoperă <em>Partea a II-a</em> a Monitorului Oficial — actele de cameră:
          stenograme, sinteze de comisie, întrebări și interpelări, rapoarte instituționale. Nu
          acoperă <em>Partea I</em> (legi promulgate, decrete, hotărâri de guvern, ordonanțe) și
          nici celelalte părți. Pentru aceste acte, sursa este tot site-ul oficial.
        </p>
        <p>
          Anumite documente vechi sau scanate pot avea lacune. Tipic sunt stenogramele dinainte de
          2015 cu erori de scanare sau cu inserții corupte: programul le validează ca fiind
          structural valide, dar lasă fragmente de text care nu apar la căutare. Aceste documente
          sunt în arhivă fără semnale de alertă; cititorii care observă lipsa unei intervenții pe
          care o cunosc din altă sursă o pot raporta (vezi{" "}
          <a href="#corectii" className="underline underline-offset-4 hover:text-ink-16">
            Cum semnalezi o eroare
          </a>
          ).
        </p>
        <p>
          Profilurile politicienilor sunt completate progresiv. Fiecare politician care a vorbit cel
          puțin o dată în arhivă are deja o pagină. Datele biografice (mandate, partid, an de
          naștere) sunt adăugate treptat din surse externe; un profil care arată doar numele
          canonic, fără mandate atașate, este un profil în curs de completare, nu o eroare ascunsă.
        </p>
        <p>
          Indexul curent acoperă perioada începând din 2000 și este împrospătat pe măsură ce noi
          numere ale Monitorului Oficial sunt publicate. Indexarea retroactivă pentru anii 1990–1999
          rămâne deschisă; documentele din această perioadă există în formate eterogene și necesită
          o cohortă separată de testare.
        </p>
      </Section>

      <Section id="identitate" title="De ce link-urile rămân stabile">
        <p>
          Fiecare ședință, fiecare intervenție, fiecare vot are un identificator stabil care nu se
          schimbă în timp. Un link spre o intervenție pe care îl copiezi astăzi va deschide aceeași
          intervenție și anul viitor — și peste cinci ani — chiar dacă programul care citește
          PDF-urile devine mai bun la a separa intervențiile sau dacă numerotarea internă se
          ajustează.
        </p>
        <p>
          Acesta este un contract de design, nu o promisiune politicoasă. URL-urile publicate de
          monitorul.ai sunt construite astfel încât arhiva să poată fi citată în articole, în
          lucrări de cercetare și pe rețele sociale fără ca legăturile să se rupă în timp. Dacă
          documentul-sursă mai există în arhivă, link-ul lui rezolvă la aceeași intrare.
        </p>
        <p>
          Mecanismul prin care se păstrează identitatea — chei stabile minate la importul
          documentului, o amprentă de conținut care detectează re-organizările și un slug care se
          generează o singură dată — este descris la{" "}
          <a href="#identitate-tehnic" className="underline underline-offset-4 hover:text-ink-16">
            Identitatea înregistrărilor
          </a>
          .
        </p>
      </Section>

      <Section id="cautare" title="Cum funcționează căutarea">
        <p>
          Caseta de{" "}
          <Link href="/cauta" className="underline underline-offset-4 hover:text-ink-16">
            căutare
          </Link>{" "}
          lucrează pe două niveluri în paralel:
        </p>
        <ul className="mt-2 grid gap-3 border-y border-border py-5">
          <SearchLeg
            label="Cuvinte exacte"
            body="Găsește intervențiile care conțin cuvintele tale. Funcționează cu sau fără diacritice — „sosoaca” găsește intervențiile lui „Șoșoacă”, iar formularea cu diacritice corecte rămâne prioritară."
          />
          <SearchLeg
            label="Sens apropiat"
            body="Găsește și intervenții al căror conținut este apropiat de întrebarea ta, chiar dacă nu folosesc exact aceleași cuvinte. Când întrebi „cine a vorbit despre creșterea TVA”, vezi și intervenții care discută același subiect cu termeni diferiți."
          />
        </ul>
        <p>
          Cele două liste sunt combinate într-un singur clasament. Lângă timpul de execuție vezi un
          cip <code className="font-mono-meta text-ink-16">Hibrid</code> sau{" "}
          <code className="font-mono-meta text-ink-16">BM25</code> — îți spune dacă a funcționat
          căutarea pe ambele niveluri sau doar pe primul (cazul tipic: o interogare prea scurtă, o
          interogare fără rezultate exacte, sau pagini mai adânci în clasament).
        </p>
        <p>
          Pentru a vedea toate intervențiile unei persoane sau dintr-o ședință, folosește mai
          degrabă paginile lor decât caseta de căutare — paginile structurate sunt mai precise
          pentru aceste cazuri.
        </p>
        <p>
          Detaliile tehnice (BM25, kNN, fuziune RRF, comportamente de degradare) sunt la{" "}
          <a href="#cautare-tehnic" className="underline underline-offset-4 hover:text-ink-16">
            Hibrid BM25 + kNN
          </a>
          .
        </p>
      </Section>

      <Section id="confidentialitate" title="Ce stocăm despre tine">
        <p>
          Site-ul este public și se poate citi fără cont. Atunci când îl citești în browser, NU
          stocăm cine ești — nicio identitate, nicio adresă de e-mail. Singurul moment în care
          monitorul.ai îți cere o identitate este conectarea unui asistent AI la serverul MCP, prin
          autentificare cu Google.
        </p>
        <p>
          Dacă ai un cont (autentificat cu Google), stocăm doar minimul necesar pentru ca
          autentificarea să funcționeze și pentru ca limitarea de rată să fie corectă:
        </p>
        <ul className="mt-5 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Identitate</span>
            adresa de e-mail și ID-ul contului Google — necesare pentru ca asistentul tău să te
            recunoască la următoarea conectare.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Asistenți conectați</span>
            lista clienților OAuth pe care i-ai autorizat (Claude Desktop, Cursor etc.), cu numele
            lor și momentul fiecărei conectări — vizibilă în pagina ta de cont la <code>/cont</code>
            , unde poți și revoca oricare dintre ei.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Apeluri MCP</span>
            atribuim ID-ul tău intern fiecărei cereri spre serverul MCP — nu textul interogării, nu
            răspunsul, doar &quot;contul X a făcut tool-call-ul Y la ora Z&quot;. Folosim asta ca să
            detectăm și să blocăm abuzul (de exemplu, un singur cont care încearcă să extragă tot
            corpusul cu cereri scurte).
          </li>
        </ul>
        <p className="mt-5">
          Nu vindem date, nu rulăm Google Analytics, nu înregistrăm sesiuni și nu profilăm
          vizitatori. Folosim un singur serviciu de analiză agregată anonimă (PostHog, găzduit în
          UE), configurat fără cookie-uri și fără identificare individuală — detalii pe pagina de{" "}
          <Link
            href="/confidentialitate"
            className="underline underline-offset-4 hover:text-ink-16"
          >
            confidențialitate
          </Link>
          . Ștergerea contului și a tuturor datelor asociate se face la cerere prin canalul de la{" "}
          <a href="#corectii" className="underline underline-offset-4 hover:text-ink-16">
            #corectii
          </a>
          . Detalii tehnice (ce coloane stocăm, ce serviciu de bază de date și unde) sunt la{" "}
          <a
            href="#confidentialitate-tehnic"
            className="underline underline-offset-4 hover:text-ink-16"
          >
            Date personale și log
          </a>
          .
        </p>
      </Section>

      <Section id="corectii" title="Cum semnalezi o eroare">
        <p>
          Conținutul stenogramelor este reprodus fără modificări. O divergență față de textul
          publicat în Monitorul Oficial este, prin definiție, o eroare de import și poate fi
          remediată. Categoriile tipice care apar:
        </p>
        <ul className="mt-5 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Atribuire greșită</span>
            un discurs apare la un alt vorbitor decât cel din original — de regulă o omonimie de
            nume sau o formă istorică pe care programul nu o recunoaște încă.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Tăiere greșită</span>
            o intervenție a fost ruptă în două sau două intervenții consecutive au fost lipite.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Referințe nelegate</span>
            un articol citat în text nu este conectat la legea din care face parte.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Acoperire incompletă</span>
            un fragment al stenogramei lipsește sau apare amestecat — apare în special pe documente
            scanate sau cu erori de procesare.
          </li>
        </ul>
        <p className="mt-6">
          Sesizările se trimit ca <em>issue</em> public în depozitul pipeline-ului, cu link către
          intrarea afectată din arhivă (URL-ul paginii) și o referință la documentul-sursă (numărul
          Monitorului Oficial și data ședinței). Permalink-urile fiind stabile, raportul rămâne
          reproductibil în timp.
        </p>
        <p className="mt-4">
          <TrackedExternalLink
            href="https://github.com/ciocan/monitorul-ii/issues"
            event={{ destination: "github", source_page: "despre" }}
            className="label-mono inline-flex border border-ink-16 bg-ink-16 px-4 py-2 text-paper-99 transition-colors hover:bg-ink-30"
            rel="noreferrer"
            target="_blank"
          >
            Deschide un issue ›
          </TrackedExternalLink>
        </p>
        <p className="mt-6 text-sm leading-relaxed text-ink-45">
          Cererile de retragere a unor conținuturi sensibile (de exemplu numele unei părți civile
          dintr-un dosar care a fost ulterior anonimizat printr-o decizie judecătorească) se
          gestionează separat: pagina afectată poate fi marcată ca neindexabilă până la rezolvarea
          sursei. Folosiți același canal pentru aceste cazuri.
        </p>
      </Section>

      <Section id="sursa" title="Surse și licență">
        <p>
          Stenogramele provin din PDF-urile publicate de Regia Autonomă „Monitorul Oficial” pe{" "}
          <TrackedExternalLink
            href="https://monitoruloficial.ro"
            event={{ destination: "monitoruloficial", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            monitoruloficial.ro
          </TrackedExternalLink>
          . Sunt acte publice oficiale, reproduse aici fără modificări.
        </p>
        <p>
          Site-urile oficiale ale celor două camere —{" "}
          <TrackedExternalLink
            href="https://www.cdep.ro"
            event={{ destination: "cdep", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            cdep.ro
          </TrackedExternalLink>{" "}
          și{" "}
          <TrackedExternalLink
            href="https://www.senat.ro"
            event={{ destination: "senat", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            senat.ro
          </TrackedExternalLink>{" "}
          — rămân autoritatea pentru componența curentă, calendarul ședințelor și textul
          inițiativelor legislative. Pentru actele cu efect juridic (legi, decrete, hotărâri de
          guvern, ordonanțe), sursa este <em>Monitorul Oficial Partea I</em>, care nu face obiectul
          acestei arhive.
        </p>
        <p>
          Codul-sursă al pipeline-ului este public la{" "}
          <TrackedExternalLink
            href="https://github.com/ciocan/monitorul-ii"
            event={{ destination: "github", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            github.com/ciocan/monitorul-ii
          </TrackedExternalLink>
          ; codul site-ului este public la{" "}
          <TrackedExternalLink
            href="https://github.com/ciocan/monitorul.ai"
            event={{ destination: "github", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            github.com/ciocan/monitorul.ai
          </TrackedExternalLink>
          . Schemele și mappings-urile sunt versionate alături de cod, deci orice intrare din arhivă
          poate fi reconstituită din sursă.
        </p>
      </Section>

      <PartHeader
        partLabel="Partea a II-a"
        title="Detalii tehnice"
        subtitle="Pipeline-ul de import, mecanismul de identitate al înregistrărilor și componenta de căutare. Util pentru jurnaliștii de date, cercetătorii și dezvoltatorii care folosesc arhiva ca sursă reproductibilă."
      />

      <Section id="pipeline" title="Pipeline-ul în opt pași">
        <p>
          Ingestia este realizată de pipeline-ul deschis{" "}
          <TrackedExternalLink
            href="https://github.com/ciocan/monitorul-ii"
            event={{ destination: "github", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            monitorul-ii
          </TrackedExternalLink>
          , care rulează independent de acest site. Datele trec prin opt etape, fiecare cu
          răspundere clară și producând un artefact verificabil pe disc:
        </p>
        <ol className="mt-6 divide-y divide-border border-y border-border">
          <PipelineStep
            n={1}
            label="Fetch"
            body="Descărcare zilnică a indexului oficial și a PDF-urilor noi. Fiecare PDF este scris atomic și hash-uit (sha256) înainte de a fi marcat ca disponibil."
          />
          <PipelineStep
            n={2}
            label="Convert"
            body="Conversie PDF → markdown, cu eliminarea antetelor, paginației și liniilor moi de tăiere a cuvintelor. PDF-urile scanate fără strat text sunt detectate separat și rutate manual prin OCR."
          />
          <PipelineStep
            n={3}
            label="Classify"
            body="Etichetare după tipul documentului: stenogramă plenară, ședință comună, sinteză de comisie, registru de întrebări scrise, raport instituțional. Detecția folosește semnale din anteturi și din primii 10 KB ai corpului."
          />
          <PipelineStep
            n={4}
            label="Extract"
            body="Markdown → JSON canonic, cu o schemă strictă per tip de document. Pentru stenograme se decupează ședința, ordinea de zi, fiecare punct, intervențiile, voturile și interpelările. Validarea schemei rulează înainte de scriere."
          />
          <PipelineStep
            n={5}
            label="Link"
            body="Trei pase de legare: rapoartele se atașează la ședința în care au fost prezentate; voturile amânate se leagă de votul care le rezolvă; trimiterile bare la „art. N” se ancorează la cea mai recentă referință explicită din aceeași listă."
          />
          <PipelineStep
            n={6}
            label="Backfill"
            body="Asocierea valorilor brute cu registre curate: ministere, instituții care raportează, persoanele din registrul de politicieni. Numele cu diacritice greșite, abrevieri sau forme istorice sunt rezolvate la un identificator canonic."
          />
          <PipelineStep
            n={7}
            label="Embed"
            body="Generarea vectorilor semantici (BGE-M3, 1024 dimensiuni) pentru fiecare discurs substanțial, titlu de ordine de zi, interpelare și raport. Vectorii sunt fingerprintați față de textul-sursă, deci re-emiterea lor este idempotentă."
          />
          <PipelineStep
            n={8}
            label="Index"
            body="Proiectarea sidecar-urilor JSON pe nouă indici Elasticsearch (documente, puncte ale ordinii de zi, discursuri, voturi, interpelări, întrebări, ședințe de comisie, rapoarte, persoane). Acești indici sunt o derivare; sursa de adevăr rămâne pe disc și pe stocarea obiectuală."
          />
        </ol>
        <p className="mt-6">
          Sursa de adevăr este setul de fișiere de pe disc, nu Elasticsearch. Dacă indexul se pierde
          complet, poate fi reconstruit într-o noapte din sidecar-urile JSON și din artefactele
          versionate alături. Această proprietate este intenționată: arhiva este construită ca să
          supraviețuiască infrastructurii care o servește.
        </p>
      </Section>

      <Section id="identitate-tehnic" title="Identitatea înregistrărilor">
        <p>
          Fiecare înregistrare — un document, un punct al ordinii de zi, un discurs, un vot, o
          interpelare, o întrebare, o ședință de comisie, un raport, o persoană — primește la
          extragere un <code className="font-mono-meta text-ink-16">record_id</code> stabil,
          persistat în sidecar-ul JSON. Identitatea este compozabilă din chei naturale: documentul
          este <code className="font-mono-meta text-ink-16">mo://YYYY/PART/ISSUE</code>; un punct al
          ordinii de zi adaugă{" "}
          <code className="font-mono-meta text-ink-16">#agenda-&lt;ord&gt;</code>; un discurs adaugă
          încă o secvență. Această cheie este preluată direct ca identificator în Elasticsearch și
          ca bază pentru URL-ul publicat.
        </p>
        <p>
          Pe lângă identificator, fiecare înregistrare poartă un <em>content fingerprint</em>: un
          sha256 trunchiat la 12 caractere, calculat peste conținutul normalizat al înregistrării.
          Fingerprint-ul nu este cheie primară, ci o referință criminalistică: când un extractor
          este îmbunătățit și granulele se reorganizează, un script de migrare poate spune „vechiul{" "}
          <code className="font-mono-meta text-ink-16">act-12</code> este același discurs ca noul{" "}
          <code className="font-mono-meta text-ink-16">act-12</code> (fingerprint coincide) —
          păstrăm slug-ul publicat”, sau dimpotrivă „vechiul{" "}
          <code className="font-mono-meta text-ink-16">act-12</code> a dispărut — retragem URL-ul”.
        </p>
        <p>
          Slug-ul publicat este mintat o singură dată. La re-extragere, dacă{" "}
          <code className="font-mono-meta text-ink-16">record_id</code> rămâne neschimbat, slug-ul
          anterior este preluat din sidecar-ul de pe disc și păstrat — chiar dacă logica de generare
          a evoluat. Acest contract <em>slug-once</em> blochează URL-urile publicate împotriva
          schimbărilor de extractor: o citare făcută în 2025 într-un articol sau pe rețele sociale
          va rezolva la aceeași înregistrare în 2030, presupunând că documentul-sursă mai există în
          arhivă.
        </p>
        <p>
          Identitatea persistată în sidecar este motivul pentru care site-ul, pipeline-ul de
          îmbogățire (rezumate, NER, codificări de discurs) și jurnalul agentului LLM pot folosi
          aceleași chei — fără ca fiecare consumator să-și re-implementeze regulile de generare și
          fără ca derivele să apară în liniște.
        </p>
      </Section>

      <Section id="cautare-tehnic" title="Hibrid BM25 + kNN">
        <p>
          Căutarea de pe{" "}
          <Link href="/cauta" className="underline underline-offset-4 hover:text-ink-16">
            /cauta
          </Link>{" "}
          combină două strategii care răspund la întrebări diferite:
        </p>
        <ul className="mt-2 grid gap-3 border-y border-border py-5">
          <SearchLeg
            label="BM25"
            body="Potrivire lexicală peste textul discursului, titlul punctului ordinii de zi și numele vorbitorului. Fiecare câmp principal este indexat și într-o variantă „folded”, fără diacritice — astfel căutarea „sosoaca” găsește intervențiile lui „Șoșoacă” via subcâmpurile .folded, iar interogările cu diacritice corecte rămân prioritare."
          />
          <SearchLeg
            label="kNN semantic"
            body="Vectori BGE-M3 (1024 dimensiuni) pe câmpul „enrichments.embedding”. Întrebări formulate liber — „cine a vorbit despre creșterea TVA”, „discursuri în jurul cazului Caracal” — recuperează intervenții al căror conținut este apropiat semantic, chiar dacă nu folosesc cuvintele exacte din interogare."
          />
        </ul>
        <p>
          Cele două liste de rezultate sunt combinate prin <em>Reciprocal Rank Fusion</em>{" "}
          (constanta standard 60), aplicată pe partea de client al ES, nu prin retrievers nativi —
          implementarea nativă a RRF în Elasticsearch este sub licență comercială. Modul activ
          pentru o interogare este afișat ca un cip{" "}
          <code className="font-mono-meta text-ink-16">Hibrid</code> sau{" "}
          <code className="font-mono-meta text-ink-16">BM25</code> alături de timpul de execuție.
        </p>
        <p>
          Cazurile în care căutarea rulează doar BM25 sunt explicite: interogarea este goală,
          serviciul de embedding este momentan inaccesibil, utilizatorul a paginat dincolo de
          adâncimea în care fuziunea mai are sens (~10 pagini), sau căutarea lexicală a returnat
          zero rezultate (caz în care o căutare semantică pe termen lipsit de înțeles ar genera
          potriviri plauzibile dar irelevante). Modul implicit pentru navigarea unui politician sau
          a unui document este filtrul direct după identitatea înregistrării, nu căutarea — paginile
          structurate sunt mai precise pentru aceste cazuri.
        </p>
      </Section>

      <Section id="confidentialitate-tehnic" title="Date personale și log">
        <p>
          Autentificarea pe serverul MCP este implementată prin Better Auth (
          <code>better-auth</code>) cu plugin-ul <code>mcp</code>: OAuth 2.0 + PKCE + dynamic client
          registration (DCR), conform RFC-urilor 7591 / 9728 și specificației MCP. Single social
          provider activ — Google. Token-urile (access ~24 ore, refresh ~30 zile) sunt semnate cu
          secretul HS256 din variabila de mediu <code>BETTER_AUTH_SECRET</code>.
        </p>
        <p>
          Backing store: Neon Postgres (proiect <code>monitorul-ai</code>) cu schema:
        </p>
        <ul className="mt-2 list-none space-y-2 border-l border-border pl-5">
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">user</strong> — id, name, email, emailVerified, image
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">session</strong> — id, userId, expiresAt, token,
            ipAddress, userAgent
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">account</strong> — providerId, accountId, accessToken,
            refreshToken, idToken
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">oauth_application</strong> — clientId, name,
            redirectUrls, metadata, userId (proprietar)
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">oauth_access_token</strong> — accessToken, refreshToken,
            scopes, clientId, userId, expirări
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">oauth_consent</strong> — clientId, userId, scopes,
            consentGiven
          </li>
        </ul>
        <p className="mt-5">
          Atribuția per cerere se face prin câmpul{" "}
          <code className="font-mono-meta text-ink-16">user_id</code> adăugat în fiecare rând al
          indexului <code className="font-mono-meta text-ink-16">monitorul_query_log</code>. Câmpul
          rămâne <code>null</code> pentru traficul anonim al site-ului (RSC pages, autocomplete) și
          conține ID-ul intern Better Auth pentru toate apelurile prin server-ul MCP. Stocăm
          momentul, tool-call-ul și argumentele — nu rezultatele și nu textul documentelor extrase.
          Schema completă este în repo:{" "}
          <TrackedExternalLink
            href="https://github.com/ciocan/monitorul.ai/blob/main/docs/architecture.md"
            event={{ destination: "github", source_page: "despre" }}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            docs/architecture.md
          </TrackedExternalLink>
          .
        </p>
        <p>
          Bază legală pentru prelucrare: interes legitim (limitarea de rată și diagnoza abuzului
          serverului MCP) plus consimțământ explicit la momentul autentificării (ecranul de
          consimțământ <code>/cont/consimt</code> arată numele și URL-ul aplicației înainte de
          acordare). Drepturile conform GDPR / Regulamentului UE 2016/679 — acces, rectificare,
          ștergere, portabilitate, restricționare, opoziție — se exercită prin canalul{" "}
          <a href="#corectii" className="underline underline-offset-4 hover:text-ink-16">
            #corectii
          </a>
          . Pentru ștergerea contului: deschide un issue în repo cu adresa de e-mail asociată
          contului; ștergem rândul din <code>user</code> (cascadă spre <code>session</code>,{" "}
          <code>account</code>, <code>oauth_*</code>) și rescriem
          <code>user_id</code> la <code>null</code> în log-urile reținute istoric.
        </p>
        <p>
          Fără cookie-uri terțe, fără pixel de tracking, fără rețele de publicitate, fără session
          replay. Folosim PostHog (instanță UE-Frankfurt) pentru analiză strict agregată anonimă
          configurată cookieless (
          <code className="font-mono-meta text-ink-16">persistence: &apos;memory&apos;</code>,{" "}
          <code className="font-mono-meta text-ink-16">person_profiles: &apos;never&apos;</code>,{" "}
          <code className="font-mono-meta text-ink-16">autocapture: false</code>,{" "}
          <code className="font-mono-meta text-ink-16">disable_session_recording: true</code>).
          Singurele cookie-uri scrise local sunt cele de sesiune Better Auth (prefix{" "}
          <code className="font-mono-meta text-ink-16">mo.</code>), strict necesare pentru
          autentificarea OAuth și nevizibile de alte domenii. Detaliile complete despre PostHog
          (sub-procesor, transferuri, retenție 12 luni, opt-out via Do Not Track) sunt pe pagina de{" "}
          <Link
            href="/confidentialitate"
            className="underline underline-offset-4 hover:text-ink-16"
          >
            confidențialitate
          </Link>
          .
        </p>
      </Section>
    </article>
  );
}

function TocColumn({
  partLabel,
  partTitle,
  items,
  startNumber,
}: {
  partLabel: string;
  partTitle: string;
  items: TocItem[];
  startNumber: number;
}) {
  return (
    <div>
      <p className="font-mono-meta text-xs text-ink-45">{partLabel}</p>
      <p className="label-mono mt-1 text-ink-30">{partTitle}</p>
      <ol className="mt-4 grid gap-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-baseline gap-3">
            <span
              className="font-mono-meta w-6 shrink-0 text-xs text-ink-45"
              data-tabular-nums=""
              aria-hidden="true"
            >
              {String(startNumber + i).padStart(2, "0")}
            </span>
            <a
              href={`#${item.id}`}
              className="text-base leading-snug text-ink-30 underline-offset-4 hover:text-ink-16 hover:underline"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PartHeader({
  partLabel,
  title,
  subtitle,
}: {
  partLabel: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mt-20 scroll-mt-24 border-t-2 border-ink-30 pt-10">
      <p className="label-mono text-ink-45">{partLabel}</p>
      <h2 className="font-display mt-3 text-3xl text-ink-16 sm:text-4xl">{title}</h2>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">{subtitle}</p>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="mt-12 scroll-mt-24 border-t border-border pt-10"
    >
      <h3 id={`${id}-h`} className="font-display text-2xl text-ink-16 sm:text-3xl">
        {title}
      </h3>
      <div className="mt-6 grid max-w-prose gap-4 text-base leading-relaxed text-ink-30">
        {children}
      </div>
    </section>
  );
}

function PipelineStep({ n, label, body }: { n: number; label: string; body: string }) {
  return (
    <li className="grid grid-cols-[3rem_8rem_1fr] items-baseline gap-x-5 py-4 sm:grid-cols-[3.5rem_10rem_1fr]">
      <span className="font-mono-meta text-sm text-ink-45" data-tabular-nums="" aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      <span className="label-mono text-ink-16">{label}</span>
      <span className="text-base leading-relaxed text-ink-30">{body}</span>
    </li>
  );
}

function SearchLeg({ label, body }: { label: string; body: string }) {
  return (
    <li className="grid items-baseline gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-5">
      <span className="label-mono text-ink-16">{label}</span>
      <span className="text-base leading-relaxed text-ink-30">{body}</span>
    </li>
  );
}

function DespreJsonLd() {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/despre`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${url}#about`,
    name: TITLE,
    description: DESCRIPTION,
    url,
    inLanguage: "ro",
    isPartOf: {
      "@type": "WebSite",
      name: "monitorul.ai",
      url: env.NEXT_PUBLIC_SITE_URL,
    },
    about: {
      "@type": "Thing",
      name: "Monitorul Oficial al României, Partea a II-a",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
