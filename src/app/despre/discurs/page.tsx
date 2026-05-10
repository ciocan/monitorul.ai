import type { Metadata } from "next";
import Link from "next/link";

import { Dateline } from "@/components/dateline";
import { env } from "@/env";

// Dedicated methodology page for the discourse-analysis layer. Split into
// two parts to mirror /despre: Part I is plain Romanian for citizens /
// journalists / readers without a tech background; Part II is the technical
// deep-dive (per-framework rubric, voice classifier, pipeline, disclaimer,
// roadmap) for data journalists, researchers, and developers. Linked from
// every aggregating discourse surface (speech detail, politician panel,
// /statistici methodology block, document stat strip). ISR 1h, JSON-LD
// `AboutPage`. Source documents: `monitorul/docs/discourse-analysis-schema.md`,
// `monitorul/docs/canonical-queries.md`, the four prompt files in
// `monitorul/prompts/`.
export const revalidate = 3600;

const TITLE = "Analiza discursului — metodologie";
const DESCRIPTION =
  "Cum sunt codate intervențiile parlamentare pe patru cadre publicate (Hawkins populism, V-Party anti-pluralism, DQI calitate deliberativă, atribuire de voce). Întâi o privire de ansamblu, apoi rubrici detaliate, prompt-uri, modele și disclaimer.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/despre/discurs" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    locale: "ro_RO",
    url: "/despre/discurs",
  },
};

interface TocItem {
  id: string;
  label: string;
}

const TOC_PART_ONE: TocItem[] = [
  { id: "ce-este", label: "Ce este analiza de discurs" },
  { id: "de-ce", label: "De ce o publicăm" },
  { id: "ce-vezi", label: "Unde apare în arhivă" },
  { id: "patru-cadre", label: "Cele patru cadre" },
  { id: "voce", label: "Cine vorbește, de fapt" },
  { id: "ce-nu-este", label: "Ce nu este analiza" },
  { id: "acoperire-discurs", label: "Acoperire și limite" },
  { id: "corectii-discurs", label: "Cum semnalezi o eroare" },
];

const TOC_PART_TWO: TocItem[] = [
  { id: "hawkins-tehnic", label: "Hawkins · populism" },
  { id: "vparty-tehnic", label: "V-Party · anti-pluralism" },
  { id: "dqi-tehnic", label: "DQI · calitate deliberativă" },
  { id: "voce-tehnic", label: "Atribuirea de voce" },
  { id: "pipeline-tehnic", label: "Pipeline-ul de codare" },
  { id: "filtre-tehnic", label: "Filtrele URL" },
  { id: "disclaimer", label: "Disclaimer metodologic" },
  { id: "harta", label: "Drumul mai departe" },
];

export default function DespreDiscursPage() {
  return (
    <article className="mx-auto w-full max-w-(--breakpoint-lg) px-6 py-12 sm:py-16">
      <DespreDiscursJsonLd />

      <Dateline parts={["Notă metodologică", "Analiza discursului", "Monitorul.ai"]} />

      <header className="mt-6 border-b border-border pb-10">
        <h1 className="font-display text-4xl leading-[1.05] text-ink-16 sm:text-5xl lg:text-6xl">
          {TITLE}
        </h1>
        <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-30">
          Pe lângă textul stenogramelor, monitorul.ai publică un strat suplimentar de codare:
          fiecare intervenție substanțială este analizată sub patru cadre din literatura de științe
          politice — populismul Hawkins, anti-pluralismul V-Party / V-Dem, calitatea deliberativă
          Steiner-Bächtiger și atribuirea de voce. Această pagină explică ce înseamnă fiecare cadru,
          cum sunt produse codările, ce limite au și de ce am ales tocmai aceste rubrici.
        </p>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
          Ca și în{" "}
          <Link href="/despre" className="underline underline-offset-4 hover:text-ink-16">
            nota generală
          </Link>{" "}
          despre arhivă, partea întâi este pentru cititorul fără pregătire tehnică, partea a doua
          pentru cei care vor să intre adânc în rubrici, prompt-uri și modele.
        </p>
      </header>

      <nav aria-labelledby="cuprins-discurs" className="mt-10 border-b border-border pb-10">
        <h2 id="cuprins-discurs" className="label-mono text-ink-30">
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
        subtitle="O privire de ansamblu, fără jargon. Ce înseamnă „analiză de discurs”, de ce o publicăm, ce poți face cu ea și ce nu."
      />

      <Section id="ce-este" title="Ce este analiza de discurs">
        <p>
          Analiza de discurs este un strat de etichete pe care le punem peste textul fiecărei
          intervenții parlamentare substanțiale. Eticheta nu schimbă cuvintele rostite — textul
          stenogramei rămâne neatins. Eticheta răspunde la câteva întrebări precise:{" "}
          <em>conține acest discurs un cadru populist „popor versus elite”?</em>;{" "}
          <em>delegitimează vorbitorul opoziția, justiția sau presa ca instituții?</em>;{" "}
          <em>oferă vorbitorul motive substanțiale pentru poziția sa, sau doar o afirmă?</em>;{" "}
          <em>vorbește în nume propriu sau citează / parafrazează / neagă?</em>
        </p>
        <p>
          Răspunsurile vin sub forma unor <em>marcheri</em>: fiecare element rhetoric detectat este
          ancorat de un fragment de text concret și etichetat cu un nivel de încredere. Pe pagina
          fiecărui discurs poți deschide marcherul și vedea exact citatul pe care se sprijină
          codarea — și-l poți contesta dacă nu ești de acord cu interpretarea.
        </p>
        <p>
          Codările sunt produse de un model de limbaj (LLM), urmând prompt-uri publice versionate
          care reproduc rubrici academice publicate. Nu inventăm cadrele de analiză; le aplicăm pe
          corpus-ul românesc.
        </p>
      </Section>

      <Section id="de-ce" title="De ce o publicăm">
        <p>
          Citarea exactă a unei intervenții este utilă, dar nu suficientă pentru jurnaliști,
          cetățeni sau cercetători care vor să compare comportamentul retoric al politicienilor în
          timp. Întrebări de genul <em>„cine a folosit cel mai des cadrul populist în 2024?”</em>{" "}
          sau <em>„ce parlamentari au atacat cel mai sistematic justiția ca instituție?”</em> nu pot
          fi răspunse doar prin căutare cu cuvinte cheie — un discurs care <strong>denunță</strong>{" "}
          populismul conține aceleași cuvinte ca unul care îl <strong>practică</strong>. Diferența
          este atribuibilă numai prin codare structurată.
        </p>
        <p>Trei intenții stau în spatele acestui strat:</p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Comparabilitate</span>
            cadrele alese (Hawkins, V-Party, V-Dem, DQI) sunt instrumente cu care echivalente
            internaționale au fost măsurate — Orbán, Kaczyński, Le Pen, Trump, Modi, Erdoğan.
            Codarea sub aceste rubrici așează discursul românesc pe aceeași axă.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Reproductibilitate</span>
            rubricile sunt publicate în reviste de specialitate cu acord inter-codator (κ ≈ 0.7) și
            cu sute de studii cumulate în spate. Asta înseamnă că o concluzie făcută pe acest corpus
            poate fi verificată de un alt cercetător sub aceeași rubrică.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Apărabilitate</span>
            codarea face afirmații despre <em>ce s-a spus</em>, nu despre cine este vorbitorul.
            Distincția este atât editorială cât și juridică — vom reveni la ea la{" "}
            <a href="#ce-nu-este" className="underline underline-offset-4 hover:text-ink-16">
              Ce nu este analiza
            </a>
            .
          </li>
        </ul>
      </Section>

      <Section id="ce-vezi" title="Unde apare în arhivă">
        <p>Stratul de discurs apare pe patru tipuri de pagini, fiecare cu un scop diferit:</p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Discurs</span>
            pe pagina fiecărui discurs (de exemplu{" "}
            <code className="font-mono-meta text-ink-16">/discurs/&lt;slug&gt;</code>) vezi
            etichetele inline peste text și o listă de marcheri în coloana din dreapta; fiecare
            marcher este conectat la fragmentul exact pe care se sprijină.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Politician</span>
            pe pagina unui politician,{" "}
            <code className="font-mono-meta text-ink-16">/politicieni/&lt;slug&gt;</code>, apare un
            panou cu evoluția celor patru cadre pe luni / ani și un grafic cu un punct pentru
            fiecare discurs analizat.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Document</span>
            pe pagina unei ședințe,{" "}
            <code className="font-mono-meta text-ink-16">
              /mo/&lt;an&gt;/&lt;part&gt;/&lt;număr&gt;
            </code>
            , un mic rezumat de antet sintetizează codările tuturor intervențiilor analizate din
            document.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Statistici</span>
            la{" "}
            <Link href="/statistici" className="underline underline-offset-4 hover:text-ink-16">
              /statistici
            </Link>{" "}
            apar agregările pe sistem: serii temporale, harta H × V, clasamente cu intervale de
            încredere bootstrap și un treemap de marcheri. Aceste agregări sunt vechiul răspuns la
            întrebări de tip „cine, când, cât”.
          </li>
        </ul>
      </Section>

      <Section id="patru-cadre" title="Cele patru cadre">
        <p>
          Stratul actual conține patru cadre. Trei dintre ele măsoară patologii (populism,
          anti-pluralism); unul măsoară calitatea deliberativă (axa pozitivă). Al patrulea —
          atribuirea de voce — nu este propriu-zis un cadru, ci o etichetă obligatorie pe fiecare
          marcher: <em>cine spune asta?</em> Vorbitorul în nume propriu, sau vorbitorul citează /
          parafrazează / neagă pe altcineva?
        </p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-alert-civic">Populism</span>
            <em>
              <a
                href="https://populism.byu.edu/"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                Hawkins 2018
              </a>
            </em>{" "}
            — un scor 0/1/2 care indică în ce măsură discursul exprimă o viziune „popor virtuos
            versus elită coruptă”. Scorul este holistic, nu o sumă de marcheri.{" "}
            <strong>Score 0</strong> = nu populist; <strong>1</strong> = momente populiste într-un
            discurs altfel non-populist; <strong>2</strong> = manifestul populist, viziunea pătrunde
            tot discursul.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-alert-civic">Anti-pluralism</span>
            <em>
              <a
                href="https://www.v-dem.net/data/v-party-dataset/"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                V-Party
              </a>{" "}
              /{" "}
              <a
                href="https://www.v-dem.net/"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                V-Dem
              </a>
            </em>{" "}
            — un scor 0/1/2 care indică în ce măsură discursul atacă condițiile multi-partidismului
            democratic: delegitimarea opoziției, ostilitatea față de presă, atacul la justiție,
            vinovăția colectivă pe minorități, respingerea normelor democratice.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-azure-3">Calitate deliberativă</span>
            <em>
              <a
                href="https://www.cambridge.org/core/books/foundations-of-deliberative-democracy/2A37BAB10D8B0D8F067B0C66AC2A56AB"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                DQI Steiner-Bächtiger
              </a>
            </em>{" "}
            — singurul cadru pozitiv. Șase sub-codări care măsoară împreună{" "}
            <em>cât de bine argumentează</em> vorbitorul: nivelul justificării, conținutul
            justificării (interes de grup vs binele comun), respect pentru grupuri, respect pentru
            cereri, respect pentru contraargumente, politică constructivă.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-30">Voce</span>
            <em>
              <a
                href="https://github.com/ciocan/monitorul-ii/blob/main/prompts/voice_classifier_v1.md"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                monitorul-ii voice@v1
              </a>
            </em>{" "}
            — pentru fiecare marcher, ce voce poartă: vorbitorul însuși, citat, vorbire indirectă,
            negat, ipotetic, apofază („nu spun X, dar...”), atribuire echivocă („unii spun că...”),
            sarcastic, întrebare retorică, sau incertă. Filtrul implicit pe site este{" "}
            <strong>vocea proprie</strong>.
          </li>
        </ul>
        <p className="mt-6">
          Detalii rubrică-cu-rubrică (markeri, exemple românești, scoruri-limită) la partea a doua:{" "}
          <a href="#hawkins-tehnic" className="underline underline-offset-4 hover:text-ink-16">
            Hawkins
          </a>
          ,{" "}
          <a href="#vparty-tehnic" className="underline underline-offset-4 hover:text-ink-16">
            V-Party
          </a>
          ,{" "}
          <a href="#dqi-tehnic" className="underline underline-offset-4 hover:text-ink-16">
            DQI
          </a>
          ,{" "}
          <a href="#voce-tehnic" className="underline underline-offset-4 hover:text-ink-16">
            atribuirea de voce
          </a>
          .
        </p>
      </Section>

      <Section id="voce" title="Cine vorbește, de fapt">
        <p>
          Acesta este cel mai important detaliu metodologic. O analiză automată naivă va eșua
          spectaculos pe stenogramele parlamentare dintr-un motiv simplu: politicienii își citează
          adversarii foarte des. Un parlamentar care <strong>denunță</strong> retorica anti-maghiară
          conține în discurs aceleași fraze pe care le folosește un parlamentar care{" "}
          <strong>practică</strong> acea retorică. Diferența este voce: unul citează ca să respingă,
          altul afirmă în nume propriu.
        </p>
        <p>
          Dacă o aplicație ignoră această distincție, denunțătorul ajunge clasat ca extremist.
          Concluziile sunt nu doar greșite — sunt echivalente unei calomnii la scară. Tocmai de
          aceea fiecare marcher are o etichetă de voce, atribuită de un clasificator separat care
          primește textul, contextul și un set de indicii (citez:, „nu spun că X, dar...”, etc.).
          Filtrul implicit din UI <strong>arată numai marcherii rostiți în nume propriu</strong>,
          ascunzând citatele și negările. Poți deschide filtrul „toate vocile” pentru a vedea
          inclusiv atribuirile indirecte, dar este responsabilitatea cititorului să le interpreteze
          corect.
        </p>
        <p>
          Cazul cel mai delicat este apofaza — frazele de tipul{" "}
          <em>„Nu spun că ungurii vor să cucerească Transilvania, dar...”</em>. Literal este o
          negație, dar funcția retorică este afirmarea: vorbitorul plantează ideea în mintea
          audienței prin negația ei. Schema marchează separat acest tip de construcție ca{" "}
          <strong>apofază</strong> și o include explicit în clasamente paralele care arată retorica
          „sub umbrelă deniabilă”.
        </p>
      </Section>

      <Section id="ce-nu-este" title="Ce nu este analiza">
        <p>
          Stratul de discurs este un instrument de explorare, nu un verdict. Distincția este
          importantă din mai multe motive:
        </p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Per discurs, nu per persoană</span>
            schema codează <em>discursuri</em>, nu <em>politicieni</em>. „Acest discurs conține un
            cadru populist Hawkins=2 cu evidență la liniile 412–418” este o afirmație apărabilă.
            „Politicianul X este populist” este o afirmație despre personalitate — nu despre
            comportamentul retoric — și schema o evită deliberat. Clasamentele de la{" "}
            <Link href="/statistici" className="underline underline-offset-4 hover:text-ink-16">
              /statistici
            </Link>{" "}
            sunt agregări de marcheri pe ferestre de timp, nu profile de personalitate.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Explorare, nu publicare</span>
            cifrele de pe site nu sunt rezultate validate prin acord inter-codator. Vom publica
            statistici κ într-o versiune ulterioară (200 discursuri codate manual de 2 cercetători,
            comparate cu codarea LLM). Până atunci, tratează cifrele ca puncte de plecare pentru
            cercetarea proprie, nu ca fapt stabilit.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Cadre, nu adevăr</span>
            fiecare cadru reflectă o tradiție academică cu propriile alegeri și limite. Hawkins
            măsoară un anumit fel de populism (cadrul ideațional); alte tradiții (populism
            stratificat, populism stilistic) ar produce alte coduri pe aceleași discursuri.
            Folosirea cadrelor publicate este o alegere de apărabilitate, nu o pretenție că ele
            epuizează fenomenul.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Fără verdict de „minciuni”</span>
            am respins explicit ideea unui scor de „dezinformare” sau „minciuni”. Verificarea
            faptelor cere muncă de fact-checking, nu analiză textuală. În locul ei, schema
            detectează tipare retorice asociate cu argumentare derutantă (false dichotomii, atac la
            persoană, whataboutism). Acestea descriu <em>forma</em> retoricii, nu valoarea de adevăr
            a vreunei afirmații specifice.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Fără scor compozit</span>
            nu publicăm un „indice de demagogie” sau un „rating de autoritarism”. Sunt agregări de
            mai multe componente, iar ponderile sunt o alegere a consumatorului, nu o decizie pe
            care o impunem noi. Componenți disponibili separat; consumatori (inclusiv presa) pot
            construi compoziții documentate cu ponderile lor.
          </li>
        </ul>
      </Section>

      <Section id="acoperire-discurs" title="Acoperire și limite">
        <p>
          Acoperirea actuală: discursurile substanțiale începând cu 2020. Restul arhivei (1990 →
          2019) rămâne neanalizat momentan; pe paginile afectate veți vedea mențiunea explicită{" "}
          <em>„Acest discurs nu este încă acoperit de analiza de discurs”</em>. Nu este o eroare;
          este un stadiu al proiectului.
        </p>
        <p>
          De ce discursurile substanțiale și nu toate intervențiile? Codarea consumă timp de model,
          iar intervențiile de procedură („domnule președinte, vă rog să-mi acordați un minut...”,
          „cer cuvântul pe procedură”) nu produc semnal pe niciuna dintre cele patru cadre. Pragul
          curent este de 100 de cuvinte; sub el, intervenția intră în corpus dar nu trece prin
          clasificator.
        </p>
        <p>
          Discursurile foarte vechi (înainte de 2015, mai ales din anii '90) pot avea erori de
          scanare a PDF-urilor sursă care fac textul să fie incomplet. Aceste stenograme pot cădea
          sub pragul de 100 de cuvinte și să rămână ne-codate, sau pot fi codate cu o încredere mai
          mică. Coloana <em>încredere</em> de pe pagina discursului este indicatorul direct al
          acestei incertitudini.
        </p>
        <p>
          Roadmap-ul de extindere (κ-validare, mai multe cadre, acoperire retroactivă) apare la{" "}
          <a href="#harta" className="underline underline-offset-4 hover:text-ink-16">
            Drumul mai departe
          </a>
          .
        </p>
      </Section>

      <Section id="corectii-discurs" title="Cum semnalezi o eroare">
        <p>Codarea automată produce erori. Tipurile cele mai frecvente sunt:</p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Voce greșită</span>
            un discurs care citează populismul a fost codat ca populist. Acesta este cel mai
            important tip de eroare; raportează-l cu prioritate.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Marcher greșit ancorat</span>
            citatul de evidență din panel nu corespunde frazei reale (de exemplu, un offset byte
            greșit a făcut citatul să se taie la mijloc).
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Falsă pozitivă procedurală</span>
            un cuvânt din vocabularul parlamentar standard („reprezentanții poporului”, „voia
            națiunii”) a fost interpretat ca marker populist, deși funcționa ca limbaj convențional
            în context.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Scor calibrat anormal</span>
            un discurs evident populist scorat 0, sau invers — un discurs neutru scorat 2. Aceste
            erori indică o problemă de calibrare a clasificatorului și sunt utile pentru iterarea
            prompt-urilor.
          </li>
        </ul>
        <p className="mt-6">
          Sesizările se trimit ca <em>issue</em> public în depozitul pipeline-ului, cu link-ul către
          pagina de discurs afectată și o descriere a erorii (scorul actual, ce credeți că ar fi
          corect, motivul). Permalink-urile fiind stabile, raportul rămâne reproductibil.
        </p>
        <p className="mt-4">
          <a
            href="https://github.com/ciocan/monitorul-ii/issues"
            className="label-mono inline-flex border border-ink-16 bg-ink-16 px-4 py-2 text-paper-99 transition-colors hover:bg-ink-30"
            rel="noreferrer"
            target="_blank"
          >
            Deschide un issue ›
          </a>
        </p>
      </Section>

      <PartHeader
        partLabel="Partea a II-a"
        title="Detalii tehnice"
        subtitle="Cele patru cadre codate, prompt-uri, modele, integrare în pipeline, filtre URL și disclaimer-ul obligatoriu. Util cercetătorilor, jurnaliștilor de date și dezvoltatorilor care folosesc arhiva ca sursă reproductibilă."
      />

      <Section id="hawkins-tehnic" title="Hawkins · populism (rubrică ideațională)">
        <p>
          <strong>Cadru:</strong>{" "}
          <em>
            Hawkins, K. A. &amp; Castanho Silva, B. (2018). Textual Analysis: Big Data Approaches.
            În{" "}
            <a
              href="https://www.routledge.com/The-Ideational-Approach-to-Populism-Concept-Theory-and-Analysis/Hawkins-Carlin-Littvay-Kaltwasser/p/book/9781138716537"
              className="underline underline-offset-4 hover:text-ink-16"
              rel="noreferrer"
              target="_blank"
            >
              The Ideational Approach to Populism
            </a>
            , Routledge.
          </em>{" "}
          Resurse autoritative: pagina{" "}
          <a
            href="https://populism.byu.edu/"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            Team Populism
          </a>{" "}
          (rețeaua academică din spatele rubricii) și{" "}
          <a
            href="https://populism.byu.edu/data-section"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            Global Populism Database
          </a>{" "}
          (setul de date care aplică rubrica pe ~1900 de lideri globali).
        </p>
        <p>
          <strong>Versiune:</strong> <code className="font-mono-meta">hawkins@2018</code>; prompt:{" "}
          <code className="font-mono-meta">hawkins_populism_v1</code>; rezolvat sub rubrica
          „holistic grading” cu acord inter-codator κ ≈ 0.7 documentat în literatură.
        </p>
        <p>
          <strong>Scorul:</strong> ordinal 0 / 1 / 2, holistic — nu o sumă a marcherilor. Hawkins
          insistă explicit că rubrica <em>nu</em> este un algoritm de numărare; este o judecată
          calitativă a măsurii în care o viziune populistă „pătrunde” discursul.
        </p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">0 · non-populist</span>
            speech-ul nu exprimă o viziune populistă. Cuvinte ca „popor”, „elite”, „criză” pot
            apărea, dar în registru tehnocratic, procedural sau pluralist. Majoritatea discursurilor
            parlamentare obișnuite cad aici.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">1 · parțial / moderat</span>
            apar elemente populiste (cadrul popor-vs-elite în câteva fraze, o invocare a crizei) dar
            nu sunt sistematice. Tipic pentru discursuri de opoziție care mixează critică tehnică cu
            apeluri populiste episodice.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">2 · pe deplin populist</span>
            viziunea populistă este coloana vertebrală a discursului. Mai mulți marcheri se întăresc
            reciproc; cadrul Manichean popor-vs-elite susține structural argumentul. Este scorul cel
            mai rar; calibrarea Hawkins favorizează rezerva.
          </li>
        </ul>
        <p className="mt-6">
          <strong>Cei 7 marcheri (vocabular închis, ancore de evidență):</strong>
        </p>
        <ul className="mt-2 list-none space-y-2 border-l border-border pl-5">
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">people_vs_elite</strong> · popor vs elită — cadrul
            structural; popor virtuos, elită coruptă
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">moralistic_manichaeism</strong> · maniheism moral — bine
            versus rău, fără nuanțe
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">homogeneous_people</strong> · popor omogen — un singur
            „voce a românilor”, fără diversitate
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">evil_elite</strong> · elită coruptă — descrierea elitei
            ca activ malefică / trădătoare
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">popular_will_supremacy</strong> · supremația voinței
            populare — voia poporului mai presus de instituții
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">crisis_invocation</strong> · invocarea crizei — stakes
            existențiale, urgență dramatică
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">cosmic_proportions</strong> · miză cosmică — cadru
            civilizațional / istoric / etern
          </li>
        </ul>
        <p className="mt-6">
          <strong>Trei capcane evitate explicit în prompt:</strong> (1){" "}
          <em>Capcana numărării de marcheri</em> — un singur cadru popor-vs-elite într-un discurs de
          buget nu este Hawkins=2; pătrunderea contează, nu numărul. (2) <em>Coding orb la voce</em>{" "}
          — un discurs care neagă populismul nu poate fi Hawkins=2; numai marcherii în vocea proprie
          contribuie la scor. (3) <em>Inflație din zgomot procedural</em> — formule parlamentare
          standard („reprezentanții poporului”) NU se codează ca marcheri populiste fără context.
        </p>
        <p className="mt-4">
          Prompt-ul complet, inclusiv exemple românești pentru fiecare scor și fiecare marker, este
          public la{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii/blob/main/prompts/hawkins_populism_v1.md"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            prompts/hawkins_populism_v1.md
          </a>
          .
        </p>
      </Section>

      <Section id="vparty-tehnic" title="V-Party · anti-pluralism">
        <p>
          <strong>Cadru:</strong>{" "}
          <em>
            <a
              href="https://www.v-dem.net/data/v-party-dataset/"
              className="underline underline-offset-4 hover:text-ink-16"
              rel="noreferrer"
              target="_blank"
            >
              V-Party
            </a>
          </em>{" "}
          (Varieties of Party Identity and Organization), un proiect derivat din{" "}
          <a
            href="https://www.v-dem.net/"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            V-Dem
          </a>{" "}
          (Varieties of Democracy, Universitatea Göteborg) care codează partide politice
          internaționale pe axe de organizare și retorică. Versiunea folosită aici combină indicele
          V-Party de anti-pluralism cu sub-indicatorii V-Dem „attacks-on” (judiciary, opposition,
          media, minorities, civil society) — vezi{" "}
          <a
            href="https://www.v-dem.net/documents/70/codebook_v16.pdf"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            V-Dem Codebook
          </a>{" "}
          pentru lista completă de indicatori.
        </p>
        <p>
          <strong>Versiune:</strong> <code className="font-mono-meta">vparty@v3</code> combinat cu{" "}
          <code className="font-mono-meta">vdem-attacks@v15</code>; prompt:{" "}
          <code className="font-mono-meta">vparty_antipluralism_v2</code> (v2 a închis o falsă
          pozitivă pe atacuri la agenții administrative non-jurisdicționale identificată în testarea
          pe 30 de discursuri).
        </p>
        <p>
          <strong>De ce V-Party și V-Dem împreună:</strong> Hawkins măsoară populismul (cadrul
          popor-vs-elite). V-Party + V-Dem măsoară <em>anti-pluralismul</em> — atacurile practice la
          condițiile multi-partidismului democratic. Cele două sunt distincte jurnalistic:
        </p>
        <div className="mt-4 max-w-prose overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-normal text-ink-45"></th>
                <th className="px-3 py-2 text-left font-normal text-ink-45">V-Party scăzut</th>
                <th className="px-3 py-2 text-left font-normal text-ink-45">V-Party ridicat</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-normal text-ink-45">Hawkins scăzut</th>
                <td className="px-3 py-2 text-ink-30">Tehnocratic / pluralist</td>
                <td className="px-3 py-2 text-ink-30">Iliberalism tehnocratic</td>
              </tr>
              <tr>
                <th className="px-3 py-2 text-left font-normal text-ink-45">Hawkins ridicat</th>
                <td className="px-3 py-2 text-ink-30">Populism contestatar legitim</td>
                <td className="px-3 py-2 text-ink-16">
                  <strong>Iliberalism cu ideologie subțire</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-6">
          Cadranul jos-dreapta (Hawkins=2 + V-Party≥1) este tiparul AUR / Fidesz / PiS și semnalul
          de produs al corpus-ului. Fără măsurarea V-Party separată, nu poți distinge cele două axe.
        </p>
        <p className="mt-6">
          <strong>Scorul:</strong> ordinal 0 / 1 / 2, holistic. Aceleași praguri ca Hawkins
          (non-pluralist / parțial / pe deplin), aceleași capcane evitate explicit (numărare, voce,
          zgomot).
        </p>
        <p className="mt-6">
          <strong>Cei 5 marcheri (vocabular închis):</strong>
        </p>
        <ul className="mt-2 list-none space-y-2 border-l border-border pl-5">
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">opposition_delegitimization</strong> · delegitimarea
            opoziției — opoziția prezentată ca trădătoare, ne-română, ilegitimă
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">media_hostility</strong> · ostilitate față de presă —
            presa ca clasă (nu doar un articol specific) prezentată ca dușman / agent
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">judiciary_attack</strong> · atac la justiție — instanțe
            ca instituție delegitimate; <em>nu</em> critica unei decizii specifice
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">minority_scapegoating</strong> · vinovăție colectivă pe
            minorități — un grup minoritar invocat ca cauză a problemelor societale
          </li>
          <li className="font-mono-meta text-sm text-ink-30">
            <strong className="text-ink-16">democratic_norms_rejection</strong> · respingerea
            normelor democratice — proceduri constituționale, alegeri, separație a puterilor
            respinse de principiu
          </li>
        </ul>
        <p className="mt-6">
          <strong>Distincția critică:</strong> critica unui ministru specific, a unei decizii CCR
          specifice, a unui articol de presă specific NU sunt anti-pluralism. Marcherul se aprinde
          când <em>instituția</em> însăși este delegitimată ca clasă. Această distincție este cea
          mai frecventă sursă de fals-pozitive și este apărată explicit în prompt cu exemple
          românești.
        </p>
        <p className="mt-4">
          Prompt-ul complet (cu allowlist-ul instituțional pentru clasificarea
          <code className="font-mono-meta"> judiciary_attack</code>) este la{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii/blob/main/prompts/vparty_antipluralism_v2.md"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            prompts/vparty_antipluralism_v2.md
          </a>
          .
        </p>
      </Section>

      <Section id="dqi-tehnic" title="DQI · calitate deliberativă">
        <p>
          <strong>Cadru:</strong>{" "}
          <em>
            Steiner, J. (2012).{" "}
            <a
              href="https://www.cambridge.org/core/books/foundations-of-deliberative-democracy/6125ADD888CB9B5BF6BF5C7DF6B2865E"
              className="underline underline-offset-4 hover:text-ink-16"
              rel="noreferrer"
              target="_blank"
            >
              The Foundations of Deliberative Democracy
            </a>
            . Cambridge University Press.
          </em>{" "}
          + <em>Bächtiger, A. et al. (2017)</em>, actualizările echipei Bern. Discuția contemporană
          a indicelui apare în{" "}
          <a
            href="https://academic.oup.com/edited-volume/28086"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            Oxford Handbook of Deliberative Democracy
          </a>{" "}
          (Bächtiger, Dryzek, Mansbridge, Warren, eds., 2018).
        </p>
        <p>
          <strong>Versiune:</strong> <code className="font-mono-meta">steiner-bachtiger@2017</code>;
          prompt: <code className="font-mono-meta">dqi_v1</code>. Aplicat la peste 30 de studii
          parlamentare comparative (Bundestag, Congresul SUA, Parlamentul European, Consiliul
          Statelor elvețian) cu κ ≈ 0.7-0.8.
        </p>
        <p>
          <strong>Specific:</strong> singurul cadru cu axă pozitivă din strat. Răspunde întrebării{" "}
          <em>care discursuri sunt bune</em>, nu doar <em>care sunt rele</em>. Fără DQI, corpus-ul
          ar putea răspunde doar la întrebări despre patologie. DQI completează imaginea cu măsura
          argumentării de calitate.
        </p>
        <p>
          <strong>Multidimensional prin design — fără scor compozit:</strong> DQI este publicat și
          aplicat ca șase sub-codări simultane. Nu există un „scor DQI” unic; fiecare dintre cele
          șase dimensiuni este raportată separat:
        </p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">level_of_justification (0–3)</span>
            cât de bine motivează vorbitorul poziția. <em>0</em> = afirmație fără motiv;
            <em>1</em> = motiv inferior (circular, opinie, autoritate de grup); <em>2</em> =
            justificare calificată (motiv specific, sursă, mecanism); <em>3</em> = sofisticată (lanț
            cauzal multi-pas, surse, anticiparea obiecțiilor). Scor 3 este foarte rar.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">content_of_justification</span>
            ce face apel justificarea: <em>none</em> (fără motiv), <em>group_interest</em>{" "}
            (interesul unui grup specific — partid, regiune), <em>common_good</em> (binele comun,
            principii universale), <em>mixed</em> (ambele).
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">respect_for_groups (0–2)</span>
            cum tratează vorbitorul grupurile sociale / politice afectate. <em>0</em> = derogare
            explicită; <em>1</em> = neutru; <em>2</em> = recunoaștere explicită de legitimitate.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">respect_for_demands (0–2)</span>
            cum tratează vorbitorul cererile opoziției. <em>0</em> = respinge ca ridicole;
            <em>1</em> = ignoră; <em>2</em> = recunoaște legitimitatea cererii (chiar dacă nu o
            acceptă).
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">respect_for_counterarguments (0–2)</span>
            cum tratează vorbitorul <em>argumentele</em> opoziției. <em>0</em> = ignoră;
            <em>1</em> = recunoaște; <em>2</em> = se angajează substanțial cu ele.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">constructive_politics</span>
            <em>positional</em> (doar afirmă o poziție); <em>alternative_proposal</em> (oferă o
            propunere alternativă); <em>mediating_proposal</em> (oferă o propunere de mediere între
            poziții opuse — rar în debatul de plen românesc).
          </li>
        </ul>
        <p className="mt-6">
          <strong>Trei capcane evitate explicit în prompt:</strong> (1){" "}
          <em>Lungime confundată cu justificare</em> — un discurs lung de 400 de cuvinte care repetă
          „aceasta este necesar” poate avea level=0; un amendament de 80 de cuvinte cu un motiv
          specific poate avea level=2. (2) <em>Politețe confundată cu respect</em> — „Stimați
          colegi” + ignorarea contraargumentelor = respect=0, nu 2. (3){" "}
          <em>Inflație de „constructiv”</em> — a articula o poziție opusă mai puternic este{" "}
          <em>positional</em>, nu <em>alternative_proposal</em>.
        </p>
        <p className="mt-4">
          Prompt-ul complet, cu exemple românești pentru fiecare valoare a celor șase sub-codări,
          este la{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii/blob/main/prompts/dqi_v1.md"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            prompts/dqi_v1.md
          </a>
          .
        </p>
      </Section>

      <Section id="voce-tehnic" title="Atribuirea de voce — clasificator separat">
        <p>
          <strong>Cadru:</strong> rubrică custom dezvoltată în cadrul proiectului{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            monitorul-ii
          </a>
          , inspirată de literatura lingvistică despre evidențialitate, vorbire indirectă și
          retorica negării (apophasis). Spre deosebire de cele trei rubrici principale, nu există un
          cadru academic publicat care să codifice cele 9 voci ca un set închis aplicat discursului
          parlamentar; setul nostru este pragmatic, optimizat pentru siguranța de atribuire (vezi{" "}
          <a href="#voce" className="underline underline-offset-4 hover:text-ink-16">
            de ce contează vocea
          </a>
          ).
        </p>
        <p>
          <strong>Versiune:</strong> <code className="font-mono-meta">voice@v1</code>; prompt:{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii/blob/main/prompts/voice_classifier_v1.md"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            <code className="font-mono-meta">voice_classifier_v1</code>
          </a>
          . Rulează ca un pas separat, după ce primul pas (clasificatorii Hawkins / V-Party / DQI)
          emit marcheri cu o voce <em>preliminară</em>. Acest al doilea pas rafinează vocea cu mai
          mult context și un set închis de 9 valori posibile.
        </p>
        <p>
          <strong>De ce separat:</strong> a cere modelului să detecteze marcherul ȘI vocea într-un
          singur prompt produce rezultate fragile, cu varianță mare. Un pas separat — cu indicii
          regex pre-procesate (citez:, „nu spun că X, dar...”, etc.) — îmbunătățește consistența și
          permite escaladarea numai cazurilor incerte la un model frontier mai scump.
        </p>
        <p>
          <strong>Cele 9 voci posibile (enum închis):</strong>
        </p>
        <ul className="mt-2 list-none space-y-2 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">speaker_first_person</span>
            voce proprie — vorbitorul afirmă în nume propriu. Default-ul filtrului UI.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">quoted</span>
            citat — reproduce cuvintele altuia, marcat de „citez:”, ghilimele, etc. Câmpul{" "}
            <code className="font-mono-meta">attributed_to</code> identifică sursa.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">reported</span>
            vorbire indirectă — parafrazează o afirmație („X susține că...”).{" "}
            <code className="font-mono-meta">attributed_to</code> și aici.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">negated</span>
            negat — vorbitorul respinge afirmația, fără continuare care o re-afirmă.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">hypothetical</span>
            ipotetic — în cadru condițional / contrafactual („dacă cineva ar spune că...”).
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">apophasis_disclaimed</span>
            apofază — „nu spun că X, dar...”. Literal negație, retoric afirmare. Cazul cel mai
            delicat.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">weasel_attribution</span>
            atribuire echivocă — „unii spun că...”, „mulți cred că...”. Vorbitorul plantează ideea
            sub o atribuire vagă pe care nu o susține nominal.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">sarcastic</span>
            sarcastic — folosește vocabularul țintei pentru a-l ironiza. Necesită context pentru
            detectare.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">interrogative</span>
            întrebare retorică — „de ce să credem oare că...?”. Permite negarea plauzibilă pentru o
            afirmație implicită.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">uncertain</span>
            incertă — clasificatorul nu a putut decide. Default-ul când construcția este ambiguă.
          </li>
        </ul>
        <p className="mt-6">
          <strong>Regula de bias:</strong> implicit pe „incertă” mai degrabă decât pe „voce proprie”
          când construcția e ambiguă. Sub-detecția de voce (a tag-a un quoted ca first_person) este
          eroarea care se scalează catastrofal — denunțătorul devine extremist. Toate celelalte
          erori sunt recuperabile.
        </p>
        <p className="mt-4">
          Prompt-ul complet, cu zeci de exemple românești pentru fiecare voce și cu discutarea
          cazurilor de graniță (apophasis vs negație, sarcasm vs first-person) este la{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii/blob/main/prompts/voice_classifier_v1.md"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            prompts/voice_classifier_v1.md
          </a>
          .
        </p>
      </Section>

      <Section id="pipeline-tehnic" title="Pipeline-ul de codare">
        <p>
          Codarea de discurs este o etapă suplimentară pe lângă pipeline-ul standard de extracție
          descris în{" "}
          <Link href="/despre#pipeline" className="underline underline-offset-4 hover:text-ink-16">
            nota generală
          </Link>
          . După ce textul stenogramei a fost extras în JSON canonic și fiecare intervenție are un
          identificator stabil, etapa <code className="font-mono-meta text-ink-16">analyze</code>{" "}
          rulează clasificatorii pe discursurile substanțiale și produce un sidecar JSON{" "}
          <code className="font-mono-meta text-ink-16">.analysis.json</code> alături de cel canonic.
        </p>
        <p>
          <strong>De ce sidecar separat și nu inline în canonic:</strong>
        </p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Limpezime epistemică</span>
            schema canonică este o reprezentare deterministă a sursei — ce s-a spus, fără
            interpretare. Codările LLM sunt cu câteva ordine de mărime mai interpretative. Mixarea
            celor două ar șterge granița între „ce zice sursa” și „cum am codat-o”.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Iterare independentă</span>
            clasificatorii și rubricile vor evolua mai repede decât structura sursei. Cu sidecar
            separat, o îmbunătățire de prompt nu invalidează schema canonică sau cache-urile
            descendente (embedding-uri, indici).
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Apărabilitate juridică</span>
            dacă o codare este contestată legal, sidecar-ul poate fi recodat sub o rubrică revizuită
            fără să atingem stenograma. Dacă o instanță cere retragerea, înregistrarea de discurs
            poate fi ștersă păstrând intactă „ce s-a spus”.
          </li>
        </ul>
        <p className="mt-6">
          <strong>Versionare per cadru:</strong> fiecare cadru are propria sa versiune de rubrică și
          de prompt. Schema sidecar-ului păstrează această versiune în câmpul{" "}
          <code className="font-mono-meta text-ink-16">extractor_versions</code>:
        </p>
        <pre className="mt-3 overflow-x-auto border border-border bg-paper-96/40 p-4 font-mono-meta text-xs leading-relaxed text-ink-30">
          {`{
  "frameworks": {
    "hawkins_populism":  { "rubric_version": "hawkins@2018",
                           "prompt_version": "hawkins_v1",
                           "model": "google/gemini-3.1-flash-lite" },
    "dqi":               { "rubric_version": "steiner-bachtiger@2017",
                           "prompt_version": "dqi_v1", ... },
    "vparty_antipluralism": { ... }
  },
  "voice_classifier": { "version": "voice@0.1",
                        "prompt_version": "voice_v1", ... }
}`}
        </pre>
        <p className="mt-6">
          <strong>Modelul actual:</strong> Gemini 3.1 Flash Lite via OpenRouter este modelul
          implicit pentru codarea în volum, în baza testărilor de calitate-vs-cost peste 30 de
          discursuri pilot. Prompt-urile rulează cu structured output (output schema JSON aplicată),
          care reduce zgomotul de format. Cazurile incerte pot escalada la un model frontier (Sonnet
          / Opus class) — mecanism prevăzut în pipeline, neactiv în producție momentan.
        </p>
        <p className="mt-4">
          <strong>Idempotență per cadru:</strong> dacă Hawkins reușește pe un document și V-Party
          eșuează (timeout, rate limit, format invalid), sidecar-ul persistă cu Hawkins populat și
          V-Party absent; rerularea reia doar V-Party. Pipeline-ul este conservator cu costul: toate
          apelurile sunt logate cu tokens / cost / latency în baza de date{" "}
          <code className="font-mono-meta text-ink-16">analyses</code>, iar comanda{" "}
          <code className="font-mono-meta text-ink-16">analyze --budget USD</code> oprește graceful
          execuția când plafonul a fost atins.
        </p>
        <p className="mt-4">
          <strong>Indexare:</strong> după producerea sidecar-ului, codările sunt proiectate în
          indicele Elasticsearch <code className="font-mono-meta text-ink-16">mo-speeches</code> sub
          câmpul <code className="font-mono-meta text-ink-16">enrichments.discourse.*</code>.
          Indicele păstrează agregatele (scor, marker_count, voce dominantă) plus marker-urile
          individuale cu evidence și voce — toate accesibile filtrelor de la{" "}
          <Link href="/cauta" className="underline underline-offset-4 hover:text-ink-16">
            /cauta
          </Link>
          .
        </p>
        <p className="mt-4">
          Specificația completă a sidecar-ului, inclusiv exemple JSON pentru fiecare cadru, este la{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii/blob/main/docs/discourse-analysis-schema.md"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            docs/discourse-analysis-schema.md
          </a>{" "}
          în depozitul pipeline-ului.
        </p>
      </Section>

      <Section id="filtre-tehnic" title="Filtrele URL">
        <p>
          Toate suprafețele care arată codări de discurs (pagina discursului, pagina politicianului,
          pagina documentului, /statistici) acceptă două parametri URL comuni. Ambele sunt
          non-canonice — link-ul fără ele rămâne canonic; link-ul cu ele este o variație de filtru,
          nu o pagină distinctă pentru SEO.
        </p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">?voice=all</span>
            include și marcherii din voci ne-proprii (citat, vorbire indirectă, negat, apofază,
            etc.). Default omis = numai{" "}
            <code className="font-mono-meta text-ink-16">speaker_first_person</code>. Schimbă
            dramatic agregatele pentru politicieni care își citează adversarii frecvent.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">?conf=07</span>
            păstrează numai codările cu{" "}
            <code className="font-mono-meta text-ink-16">framework_confidence ≥ 0.7</code>. Default
            omis = nu se aplică prag. Pragul 0.7 este threshold-ul folosit în clasamentele canonice
            publicate la{" "}
            <Link href="/statistici" className="underline underline-offset-4 hover:text-ink-16">
              /statistici
            </Link>
            ; pe paginile de explorare default-ul este permisiv pentru a nu ascunde semnal slab dar
            autentic.
          </li>
        </ul>
        <p className="mt-6">
          Pe pagini de discurs, toggle-urile „voce” și „încredere” sunt în panoul lateral dreapta.
          Pe paginile de politician și de statistici, sunt deasupra graficelor. Schimbarea
          declanșează soft-navigation (Next.js router.push); cache-ul ISR se împarte natural pe
          parametrii URL.
        </p>
      </Section>

      <Section id="disclaimer" title="Disclaimer metodologic — text obligatoriu">
        <p>
          Documentul de spec{" "}
          <code className="font-mono-meta text-ink-16">canonical-queries.md</code> al pipeline-ului
          impune ca orice rezultat agregat (clasament, statistică) să fie publicat cu două
          disclaimer-uri redate verbatim. Le reproducem aici și pe orice suprafață de agregare:
        </p>
        <blockquote className="mt-4 border-l-2 border-paper-91 pl-5 text-base leading-relaxed text-ink-30">
          <p>
            <strong>Metodologic:</strong> Acest clasament / această statistică este derivat din
            analiza automată de discurs sub rubrica publicată <em>[framework_name]</em> (versiune{" "}
            <em>[rubric_version]</em>). Codările nu au fost validate față de acordul inter-codator
            uman (κ); proiectul plănuiește publicarea statisticilor κ într-o versiune ulterioară.
            Tratează acest clasament ca exploratoriu și sub revizie sub metodologii viitoare.
            Evidența per discurs — marcherii și fragmentele-sursă din spatele fiecărei codări — este
            disponibilă în sidecar-urile de analiză și ar trebui consultată dacă orice clasament
            individual este contestat.
          </p>
          <p className="mt-4">
            <strong>De model:</strong> Codările sunt produse de modelul <em>[model_id]</em> sub
            prompt-ul versiune <em>[prompt_version]</em> și rubrica versiune{" "}
            <em>[rubric_version]</em>. Recodarea sub un alt model, prompt sau configurație de
            rubrică poate produce alte clasamente. Versiunile de model și de prompt sunt fixate per
            codare în sidecar-urile de analiză; acest clasament agregă doar codările a căror tuplă{" "}
            <code>(model, prompt, rubric)</code> corespunde configurației numite mai sus.
          </p>
        </blockquote>
        <p className="mt-6">
          <strong>Ce înseamnă „κ”:</strong> coeficientul Cohen kappa, măsura standard a acordului
          între doi codatori (umani sau om-vs-LLM) corectată pentru acordul întâmplător. Hawkins
          raportează κ ≈ 0.7 între codatori umani pe rubrica sa („agreement substanțial” în
          categoriile lui Landis & Koch). Țelul nostru este să atingem un κ comparabil între LLM și
          o validare umană pe un eșantion de 200 de discursuri (5 populiști notori, 5 moderați, 5 cu
          registre variabile, ~150 random). Acest pas nu este încă livrat.
        </p>
      </Section>

      <Section id="harta" title="Drumul mai departe">
        <p>Stratul actual este versiunea 0.x. Ce urmează (în ordine probabilă):</p>
        <ul className="mt-2 list-none space-y-3 border-l border-border pl-5">
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">κ-validare</span>
            200 de discursuri codate manual de 2 cercetători români; statistici κ coder1↔coder2 și
            LLM↔fiecare coder, raportate per cadru și per dimensiune. Re-rulate la fiecare upgrade
            de prompt sau model.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Acoperire retroactivă</span>
            extinderea codării la corpus-ul pre-2020 după ce κ este stabil pe corpus-ul curent.
            Costurile sunt prevăzute în pipeline; bariera principală este iterarea prompt-urilor pe
            registre lingvistice mai vechi (1990–2010 cu vocabulare specifice perioadei).
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Cadre suplimentare</span>
            CMP / Manifesto Project (axa stânga-dreapta economică), CHES (axa cultural GAL-TAN),
            V-Dem attacks-on (sub-indicatori per țintă), securitization (Copenhagen-School),
            conspiracy framing (statul paralel, Soros, etc.). Adăugarea lor presupune un prompt nou
            per cadru și un nou pas de rulare; structura sidecar-ului este deja pregătită.
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Audience signals</span>
            join pe câmpul <code className="font-mono-meta text-ink-16">narrator</code> din canonic
            — aplauze, întreruperi, retragere, microfon tăiat. Zero LLM cost, niciun risc de
            defăimare. Va activa indicele de „polarizare” per discurs (aplauze de la o tabără,
            întreruperi de la cealaltă).
          </li>
          <li className="text-base leading-relaxed text-ink-30">
            <span className="label-mono mr-3 text-ink-16">Marcheri România-specifici</span>
            registre publice românești care nu au cadru internațional: anti-justice-reform (era OUG
            13), country_for_sale, antonescu_rehabilitation, ortodoxist_nationalist, etc. Vor avea
            propria lor versiune de prompt și disclaimer extins (defăimare mai sensibilă).
          </li>
        </ul>
        <p className="mt-6">
          Toate aceste extinderi sunt cu prioritate pe <em>apărabilitate</em> — fiecare marker nou
          primește o rubrică publicată drept ancoră, sau este flagat explicit ca{" "}
          <em>custom rubric</em> în UI și în clasamente. Nu fuzionăm rubricile publicate cu cele
          custom într-un singur scor; consumatorii primesc componente, ponderile rămân la ei.
        </p>
        <p className="mt-4">
          <strong>Cum poți contribui:</strong> dacă ai pregătire în științe politice și ești
          interesat să codezi manual un fragment din eșantionul de validare, sau dacă ai observat un
          tipar retoric repetat care nu este capturat de cadrele actuale, deschide un{" "}
          <a
            href="https://github.com/ciocan/monitorul-ii/issues"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            issue
          </a>
          . Schema este append-only; rubrici noi nu invalidează cele existente.
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

function DespreDiscursJsonLd() {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/despre/discurs`;
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
      name: "Analiza automată de discurs parlamentar",
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
