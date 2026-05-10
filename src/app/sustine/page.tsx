import type { Metadata } from "next";
import Link from "next/link";

import sustineData from "@/data/sustine-finante.json";
import { Dateline } from "@/components/dateline";
import { env } from "@/env";

// Editorial-archival support page. Five-block IA: header / situație /
// contribuie / rapoarte / întrebări. The trust argument is built from
// transparency (published costs + published code + refusal policy + refusal
// counts), not from a salesy ask. See docs/_session-handoff-2026-05-10-sustine.md
// for the full design record.
export const revalidate = 3600;

const TITLE = "Cine plătește pentru această arhivă";
const DESCRIPTION =
  "monitorul.ai este o arhivă civică, neafiliată, deschisă și reproductibilă. Această pagină arată cine o operează, cât costă și cum poți contribui.";

export const metadata: Metadata = {
  title: "Sprijin",
  description: DESCRIPTION,
  alternates: { canonical: "/sustine" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    locale: "ro_RO",
    url: "/sustine",
  },
};

const REPO_SITE = "https://github.com/ciocan/monitorul.ai";
const REPO_INDEXER = "https://github.com/ciocan/monitorul-ii";

const NUMBER_FORMATTER = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function fmtEur(value: number, opts?: { showZero?: boolean }): string {
  if (value === 0 && !opts?.showZero) return "—";
  return `${NUMBER_FORMATTER.format(value)} EUR`;
}

function fmtUsd(value: number): string {
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${NUMBER_FORMATTER.format(Math.round(value))}`;
}

export default function SustinePage() {
  const { current } = sustineData;
  const isEstimated = current.estimated;

  const stripeMonthly = env.STRIPE_PAYMENT_LINK_MONTHLY;
  const stripeOneOff = env.STRIPE_PAYMENT_LINK_ONESHOT;

  const iban = env.SUSTINE_IBAN;
  const accountName = env.SUSTINE_ACCOUNT_NAME;
  const bic = env.SUSTINE_BIC;
  const bankName = env.SUSTINE_BANK_NAME;

  const contactEmail = env.SUSTINE_CONTACT_EMAIL;

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-lg) px-6 py-12 sm:py-16">
      <SustineJsonLd />

      <Dateline
        parts={["Notă operațională", "Monitorul.ai", `Sprijin · actualizat ${current.quarter}`]}
      />

      <header className="mt-6 border-b border-border pb-10">
        <h1 className="font-display text-4xl leading-[1.05] text-ink-16 sm:text-5xl lg:text-6xl">
          {TITLE}
        </h1>
        <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-30">
          monitorul.ai este operat de{" "}
          <strong className="font-semibold text-ink-16">42 Tech Limited</strong>, o societate cu
          răspundere limitată înregistrată în Marea Britanie, deținută privat. Site-ul este o
          infrastructură civică, neafiliată de partide, instituții de stat sau organizații cu mize
          politice. Codul site-ului și al pipeline-ului de date sunt publice sub licență AGPL-3.0,
          deci oricine poate verifica metodologia, poate rula propria copie sau poate contribui cu
          îmbunătățiri.
        </p>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-30">
          Această pagină arată cât costă luna de operare, ce finanțează contribuțiile și unde poate
          fi citit raportul trimestrial. Suma și frecvența le alegi tu — nu există tarife, nu există
          praguri, nu există beneficii ascunse pentru susținători. În schimb, publicăm trimestrial
          costurile reale, veniturile, progresul codificării și orice contribuție pe care o refuzăm.
        </p>
        <p className="label-mono mt-6 max-w-prose text-ink-30">
          Nu acceptăm contribuții de la: partide politice · instituții de stat · campanii electorale
          · firme de lobby cu clienți politici · organizații media cu mize editoriale partizane.
        </p>
        <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-45">
          Codul site-ului:{" "}
          <a
            href={REPO_SITE}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            github.com/ciocan/monitorul.ai
          </a>
          . Codul pipeline-ului de date și al codificării:{" "}
          <a
            href={REPO_INDEXER}
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            github.com/ciocan/monitorul-ii
          </a>
          . Metodologia integrală:{" "}
          <Link href="/despre" className="underline underline-offset-4 hover:text-ink-16">
            /despre
          </Link>{" "}
          ·{" "}
          <Link href="/despre/discurs" className="underline underline-offset-4 hover:text-ink-16">
            /despre/discurs
          </Link>
          .
        </p>
      </header>

      <Section id="situatia" title="Situația">
        <p className="max-w-prose text-base leading-relaxed text-ink-30">
          Trei tablouri: ce plătim lunar pentru infrastructură, ce intră ca venit, cât din
          codificarea LLM este finalizată. Bugetul pentru codificare LLM este urmărit separat pentru
          că rulează ca proiect punctual pe fiecare backfill — nu este un cost lunar recurent.
          Cifrele sunt actualizate trimestrial; primul raport complet va fi cel pentru Q3 2026, după
          aproximativ trei luni de operare publică.
          {isEstimated ? (
            <>
              {" "}
              <em>
                Valorile curente sunt estimative — marcate explicit cu „est.” acolo unde nu există
                încă o lună întreagă de date reale.
              </em>
            </>
          ) : null}
        </p>

        <div className="mt-8 grid gap-10">
          <InfraTable data={current.infra_monthly_eur} estimated={isEstimated} />
          <IncomeTable data={current.income_eur} estimated={isEstimated} />
          <CoverageTable coverage={current.coverage} />
        </div>
      </Section>

      <Section id="contribuie" title="Cum poți contribui">
        <p className="max-w-prose text-base leading-relaxed text-ink-30">
          Suma o alegi tu, în EUR. Recomandăm o contribuție lunară — costurile site-ului sunt
          recurente, iar predictibilitatea ajută la planificarea codificării. Plata se face prin
          Stripe; nu îți cerem cont pe monitorul.ai.
        </p>

        <div className="mt-8 flex flex-col gap-4 border-y border-border py-8 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
            {stripeMonthly && stripeOneOff ? (
              <>
                <a
                  href={stripeMonthly}
                  rel="noreferrer"
                  target="_blank"
                  className="label-mono inline-flex items-center border border-ink-16 bg-ink-16 px-5 py-3 text-paper-99 transition-colors hover:bg-ink-30"
                >
                  Contribuie lunar ›
                </a>
                <a
                  href={stripeOneOff}
                  rel="noreferrer"
                  target="_blank"
                  className="label-mono text-ink-30 underline underline-offset-4 hover:text-ink-16"
                >
                  sau o singură dată ›
                </a>
              </>
            ) : (
              <span
                className="label-mono inline-flex items-center border border-border bg-paper-96 px-5 py-3 text-ink-45"
                aria-disabled="true"
              >
                Disponibil în curând
              </span>
            )}
          </div>
          <p className="font-mono-meta text-xs text-ink-45 sm:text-right">
            Stripe gestionează plata, factura și gestionarea abonamentului.
          </p>
        </div>

        {iban && accountName ? (
          <div className="mt-8 border border-border bg-paper-96 p-6">
            <p className="label-mono text-ink-30">Sau prin transfer bancar</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-30">
              Fără comisioane de procesare; suma ajunge integral în contul de operare. Recomandat
              pentru contribuții mai mari sau pentru sponsori instituționali care au nevoie de
              factură cu CUI.
            </p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
              <DetailRow label="Beneficiar" value={accountName} />
              <DetailRow label="IBAN" value={iban} mono />
              {bic ? <DetailRow label="BIC / SWIFT" value={bic} mono /> : null}
              {bankName ? <DetailRow label="Bancă" value={bankName} /> : null}
              <DetailRow label="Monedă" value="EUR" />
            </dl>
          </div>
        ) : null}

        <p className="mt-8 max-w-prose text-sm leading-relaxed text-ink-45">
          Contribuțiile finanțează costurile de operare, codificarea LLM (vezi „Acoperire
          codificare” mai sus) și extinderea acoperirii înapoi în timp. Susținătorii care folosesc
          serverul MCP la volume mari ne pot scrie pentru limite ridicate manual — nu există un
          sistem automat de tarife, ci un schimb operațional pe email. Contribuțiile peste 1.000
          EUR/an cumulat de la o singură sursă presupun o declarație simplă de afiliere, ca să putem
          aplica politica de refuz publicată mai sus.
        </p>
      </Section>

      <Section id="rapoarte" title="Rapoarte trimestriale">
        <p className="max-w-prose text-base leading-relaxed text-ink-30">
          Fiecare trimestru publicăm un raport scurt: costurile reale defalcate pe categorii,
          veniturile (recurente vs. unice), progresul codificării pe fiecare nivel și numărul de
          contribuții refuzate (cu motivul, dacă există). Datele pentru fiecare raport stau într-un
          fișier JSON din depozit, deci se poate face <code>git blame</code> pe oricare cifră.
        </p>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-45">
          Primul raport trimestrial complet: <strong className="text-ink-30">Q3 2026</strong>, după
          aproximativ trei luni de operare publică. Până atunci, situația curentă este afișată în
          secțiunea de mai sus, marcată ca estimativă.
        </p>
      </Section>

      <Section id="intrebari" title="Întrebări">
        {contactEmail ? (
          <p className="max-w-prose text-base leading-relaxed text-ink-30">
            Factură cu CUI · MCP cu volum mare · sponsori instituționali · alte întrebări — scrie-ne
            la{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-mono-meta text-ink-16 underline underline-offset-4"
            >
              {contactEmail}
            </a>
            .
          </p>
        ) : (
          <p className="max-w-prose text-base leading-relaxed text-ink-30">
            Pentru factură cu CUI, ridicare de limite MCP sau întrebări despre sponsorizare, adresa
            de contact va fi afișată aici după lansarea publică.
          </p>
        )}
        <p className="font-mono-meta mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-45">
          <Link
            href="/confidentialitate"
            className="underline underline-offset-4 hover:text-ink-30"
          >
            Confidențialitate
          </Link>
          <Link href="/termeni" className="underline underline-offset-4 hover:text-ink-30">
            Termeni
          </Link>
          <a
            href={`${REPO_SITE}/blob/main/LICENSE`}
            className="underline underline-offset-4 hover:text-ink-30"
            rel="noreferrer"
            target="_blank"
          >
            Cod (AGPL-3.0)
          </a>
        </p>
      </Section>
    </article>
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
      <h2 id={`${id}-h`} className="font-display text-2xl text-ink-16 sm:text-3xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="label-mono text-ink-45">{label}</dt>
      <dd className={mono ? "font-mono-meta break-all text-sm text-ink-16" : "text-sm text-ink-30"}>
        {value}
      </dd>
    </>
  );
}

function InfraTable({
  data,
  estimated,
}: {
  data: typeof sustineData.current.infra_monthly_eur;
  estimated: boolean;
}) {
  const rows: Array<{ label: string; value: number }> = [
    { label: "Găzduire (Vercel)", value: data.hosting },
    { label: "Elasticsearch", value: data.elasticsearch },
    { label: "Cloudflare R2 (PDF-uri)", value: data.r2_storage },
    { label: "Embedări (BGE-M3)", value: data.embeddings },
  ];
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <RegisterTable
      heading="Infrastructură (lună)"
      headerLeft="Categorie"
      headerRight="EUR / lună"
      footerLabel="Total infrastructură"
      footerValue={fmtEur(total, { showZero: true })}
      estimated={estimated}
      rows={rows.map((r) => ({
        label: r.label,
        value: fmtEur(r.value, { showZero: true }),
      }))}
    />
  );
}

function IncomeTable({
  data,
  estimated,
}: {
  data: typeof sustineData.current.income_eur;
  estimated: boolean;
}) {
  const total = data.recurring_monthly + data.one_off_quarter;
  return (
    <RegisterTable
      heading="Venituri din contribuții"
      headerLeft="Sursă"
      headerRight="EUR"
      footerLabel="Total trimestru"
      footerValue={fmtEur(total, { showZero: true })}
      estimated={estimated}
      rows={[
        {
          label: "Lunare recurente (Stripe) — per lună",
          value: fmtEur(data.recurring_monthly, { showZero: true }),
        },
        {
          label: "Unice (Stripe + bancă) — total trimestru",
          value: fmtEur(data.one_off_quarter, { showZero: true }),
        },
      ]}
    />
  );
}

function CoverageTable({ coverage }: { coverage: typeof sustineData.current.coverage }) {
  const tier1Status =
    coverage.tier1.status === "in_progress" ? "în curs de execuție" : coverage.tier1.status;
  const tier2Status =
    coverage.tier2.status === "awaiting_funding"
      ? "în așteptare de finanțare"
      : coverage.tier2.status;
  const tier3Status =
    coverage.tier3.status === "available_when_tier2_funded"
      ? "disponibil după finanțarea Tier 2"
      : coverage.tier3.status;

  return (
    <div>
      <p className="label-mono text-ink-30">Acoperire codificare</p>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-45">
        Schema cu trei niveluri descrisă în detaliu la{" "}
        <Link href="/despre/discurs" className="underline underline-offset-4 hover:text-ink-30">
          /despre/discurs
        </Link>
        . Tier 1 codifică toate intervențiile; Tier 2 validează un eșantion cu un model mai capabil;
        Tier 3 codifică pasaje individuale la cerere.
      </p>
      <div className="mt-5 grid gap-0 border border-border">
        <CoverageRow
          tier="Tier 1"
          model={coverage.tier1.model}
          unitCost={`${fmtUsd(coverage.tier1.cost_per_speech_usd)}/discurs`}
          status={tier1Status}
          notes={`Cheltuit până acum: ${fmtUsd(coverage.tier1.spent_usd)} pentru ${coverage.tier1.spent_period}. În lucru: ${coverage.tier1.pending_period}, cost estimat ${fmtUsd(coverage.tier1.pending_cost_estimate_usd)}. Estimare finalizare: ${coverage.tier1.estimate_completion}.`}
        />
        <CoverageRow
          tier="Tier 2"
          model={coverage.tier2.model}
          unitCost={`${fmtUsd(coverage.tier2.cost_per_speech_usd)}/discurs`}
          status={tier2Status}
          notes={`Eșantion ${coverage.tier2.sample_pct}% (~${NUMBER_FORMATTER.format(coverage.tier2.target_speeches_estimate)} discursuri). Țintă finanțare: ${fmtEur(coverage.tier2.target_funding_eur, { showZero: true })}. Finanțat: ${fmtEur(coverage.tier2.funded_eur, { showZero: true })}.`}
        />
        <CoverageRow
          tier="Tier 3"
          model={coverage.tier3.model}
          unitCost="pe cerere"
          status={tier3Status}
          notes={`Discursuri livrate: ${NUMBER_FORMATTER.format(coverage.tier3.speeches_delivered)}. ${coverage.tier3.description}`}
        />
      </div>
    </div>
  );
}

function RegisterTable({
  heading,
  headerLeft,
  headerRight,
  footerLabel,
  footerValue,
  rows,
  estimated,
}: {
  heading: string;
  headerLeft: string;
  headerRight: string;
  footerLabel: string;
  footerValue: string;
  rows: Array<{ label: string; value: string }>;
  estimated: boolean;
}) {
  return (
    <div>
      <p className="label-mono text-ink-30">
        {heading}
        {estimated ? <span className="ml-3 text-ink-45">(est.)</span> : null}
      </p>
      <table className="mt-3 w-full border border-border text-sm">
        <thead className="bg-paper-96">
          <tr>
            <th
              scope="col"
              className="label-mono border-b border-border px-3 py-2 text-left text-ink-45"
            >
              {headerLeft}
            </th>
            <th
              scope="col"
              className="label-mono border-b border-border px-3 py-2 text-right text-ink-45"
            >
              {headerRight}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="border-b border-border px-3 py-2 align-top text-ink-30">
                {row.label}
              </td>
              <td className="font-mono-meta border-b border-border px-3 py-2 text-right align-top text-ink-16 tabular-nums">
                {row.value}
              </td>
            </tr>
          ))}
          <tr>
            <td className="label-mono px-3 py-2 align-top text-ink-30">{footerLabel}</td>
            <td className="font-mono-meta px-3 py-2 text-right align-top text-ink-16 tabular-nums">
              {footerValue}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CoverageRow({
  tier,
  model,
  unitCost,
  status,
  notes,
}: {
  tier: string;
  model: string;
  unitCost: string;
  status: string;
  notes: string;
}) {
  return (
    <div className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[6rem_1fr] sm:gap-x-5">
      <div>
        <p className="label-mono text-ink-16">{tier}</p>
        <p className="font-mono-meta mt-1 text-xs text-ink-45">{model}</p>
        <p className="font-mono-meta mt-1 text-xs text-ink-45">{unitCost}</p>
      </div>
      <div>
        <p className="text-sm leading-snug text-ink-30">
          <span className="label-mono mr-2 text-ink-16">Status</span>
          {status}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-45">{notes}</p>
      </div>
    </div>
  );
}

function SustineJsonLd() {
  const url = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/sustine`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${url}#sustine`,
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
      name: "Costurile, veniturile și politica de finanțare a arhivei monitorul.ai",
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
