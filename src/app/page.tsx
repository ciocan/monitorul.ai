import Link from "next/link";

import { HomeViewedTracker } from "@/components/analytics/page-trackers";
import { FRAMEWORK_FG } from "@/components/discourse/framework-badge";
import { McpEndpointUrl } from "@/components/mcp-endpoint-url";
import { SiteSearch } from "@/components/site-search";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { formatCount } from "@/lib/format";
import { type ArchiveStats, type ArchiveStatKey, getArchiveStats } from "@/lib/search";
import type { DiscourseFramework } from "@/lib/types";
import { cn } from "@/lib/utils";

const MCP_ENDPOINT = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/mcp/server`;

export const revalidate = 3600;

interface StatRowSpec {
  key: ArchiveStatKey;
  label: string;
}

// Display order is editorial: the records the search box matches against come
// first, then the registries, then the procedural-record grains. The speech
// row uses `substantiveSpeeches` to match the public-search default
// (`is_substantive: true`, length proxy at ≥100 chars).
const STAT_ROWS: StatRowSpec[] = [
  { key: "substantiveSpeeches", label: "Discursuri substanțiale" },
  { key: "documents", label: "Sesiuni publicate" },
  { key: "persons", label: "Politicieni în registru" },
  { key: "agendaItems", label: "Puncte pe ordinea de zi" },
  { key: "votes", label: "Voturi înregistrate" },
  { key: "interpellations", label: "Interpelări" },
  { key: "questions", label: "Întrebări scrise" },
  { key: "committeeMeetings", label: "Ședințe de comisie" },
  { key: "reports", label: "Rapoarte instituționale" },
];

async function safeStats(): Promise<ArchiveStats> {
  try {
    return await getArchiveStats();
  } catch {
    // ES unreachable on first paint: render the page without the register.
    return {};
  }
}

export default async function Home() {
  const stats = await safeStats();

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-16 sm:py-20">
      <HomeViewedTracker />
      <h1 className="font-display max-w-4xl text-4xl leading-[1.05] text-ink-16 sm:text-5xl lg:text-6xl">
        Stenogramele Parlamentului României, citabile pe web.
      </h1>

      <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-30">
        Discursuri, voturi, interpelări, întrebări scrise, ședințe de comisie, rapoarte
        instituționale și un registru al politicienilor — extrase verbatim din
        <em> Monitorul Oficial al României, Partea a II-a</em>.
      </p>

      <section aria-labelledby="cauta" className="mt-10 max-w-3xl">
        <h2 id="cauta" className="sr-only">
          Caută în arhivă
        </h2>
        <SiteSearch size="lg" autoFocus />
        <p className="mt-3 text-sm text-ink-45">
          Numele unui politician, un articol de lege, un cuvânt-cheie. Răspunsul este o intrare în
          registru, nu un articol de presă.
        </p>
      </section>

      <StatsRegister stats={stats} />

      <section aria-labelledby="incepeti" className="mt-16 border-t border-border pt-10">
        <h2 id="incepeti" className="label-mono text-ink-30">
          Începeți de aici
        </h2>
        <ul className="mt-6 grid gap-px bg-border sm:grid-cols-3">
          <EntryPoint
            href="/mo"
            label="Sesiuni"
            description="Toate numerele Monitorului Oficial, indexate după data ședinței."
          />
          <EntryPoint
            href="/politicieni"
            label="Politicieni"
            description="Registrul curat al deputaților, senatorilor, miniștrilor și președinților."
          />
          <EntryPoint
            href="/comisii"
            label="Comisii"
            description="Ședințele comisiilor parlamentare cu prezența și ordinea de zi."
          />
        </ul>
      </section>

      <DiscourseRegister />

      <McpRegister />

      <section aria-labelledby="metodologie" className="mt-16 border-t border-border pt-10">
        <h2 id="metodologie" className="label-mono text-ink-30">
          Pe scurt
        </h2>
        <div className="mt-4 grid max-w-prose gap-4 text-base leading-relaxed text-ink-30">
          <p>
            monitorul.ai este o arhivă publică și independentă a stenogramelor Parlamentului. Pornim
            de la PDF-urile oficiale — Monitorul Oficial, Partea a II-a — și le transformăm în
            pagini pe care le puteți citi, căuta și cita: discursuri, voturi, întrebări, ședințe de
            comisie. Linkurile pe care le salvați astăzi vor deschide aceleași pagini și peste cinci
            ani.
          </p>
        </div>
        <p className="mt-6">
          <Link
            href="/despre"
            className="label-mono text-ink-30 underline underline-offset-4 hover:text-ink-16"
          >
            Citiți metodologia completă →
          </Link>
        </p>
      </section>
    </div>
  );
}

function StatsRegister({ stats }: { stats: ArchiveStats }) {
  const rows = STAT_ROWS.flatMap((spec) => {
    const count = stats[spec.key];
    return typeof count === "number" ? [{ ...spec, count }] : [];
  });
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="in-arhiva" className="mt-16 border-t border-border pt-10">
      <h2 id="in-arhiva" className="label-mono text-ink-30">
        În arhivă
      </h2>
      <dl className="mt-6 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-4 border-b border-border py-3"
          >
            <dt className="label-mono text-ink-30">{row.label}</dt>
            <dd className="font-mono-meta text-2xl text-ink-16" data-tabular-nums="">
              {formatCount(row.count)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EntryPoint({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <li className="bg-background">
      <Link
        href={href}
        className="group/entry block h-full p-6 transition-colors hover:bg-paper-96"
      >
        <p className="font-display text-2xl text-ink-16 group-hover/entry:underline underline-offset-4">
          {label}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-30">{description}</p>
      </Link>
    </li>
  );
}

// MCP announcement, treated as a freestanding record (DESIGN.md §5: full
// 1px border, `xl` internal padding, `Paper-96` tonal layer for emphasis).
// Quietly louder than the surrounding sections — bigger headline, typeset
// endpoint URL, four-fact register, primary CTA — but no decorative chrome:
// no gradient, no icon, no left-border accent stripe, no hero-metric.
// Importance comes from typography + placement + the live endpoint, not
// from marketing visuals (per DESIGN.md and PRODUCT.md).
function McpRegister() {
  return (
    <section aria-labelledby="mcp-public" className="mt-16">
      <div className="border border-border bg-paper-96 p-6 sm:p-10">
        <p className="label-mono text-ink-30">
          Server MCP <span className="px-1.5 text-ink-45">·</span> Monitorul.ai
          <span className="px-1.5 text-ink-45">·</span> Acces public, autentificat
        </p>

        <h2
          id="mcp-public"
          className="font-display mt-5 max-w-3xl text-2xl leading-[1.15] text-ink-16 sm:text-3xl lg:text-4xl"
        >
          Conectați un asistent AI direct la arhivă.
        </h2>

        <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-30">
          Cele 16 instrumente de căutare și interogare folosite de paginile site-ului sunt apelabile
          direct din Claude Desktop, Cursor, Cline și Codex prin <em>Model Context Protocol</em>.
          Răspunsurile vin cu link-uri verificabile pe acest site, citabile la fel ca paginile pe
          care le citiți acum.
        </p>

        <div className="mt-8 flex flex-col items-stretch overflow-hidden border border-border bg-background sm:flex-row">
          <code className="flex-1 truncate px-4 py-3 font-mono text-sm text-ink-16 sm:text-base">
            <McpEndpointUrl fallback={MCP_ENDPOINT} />
          </code>
          <span className="label-mono inline-flex items-center border-t border-border bg-paper-96 px-4 py-3 text-ink-30 sm:border-t-0 sm:border-l">
            Streamable HTTP <span className="px-2 text-ink-45">·</span> OAuth 2.0
          </span>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          <McpFact label="Instrumente" value="16" />
          <McpFact label="Autentificare" value="Google" />
          <McpFact label="Cheie acces" value="~24h" />
          <McpFact label="Limită" value="30 / min" />
        </dl>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t border-border pt-6">
          <Button asChild size="lg">
            <Link href="/mcp">Documentație și conectare</Link>
          </Button>
          <Link
            href="/cont"
            className="label-mono text-ink-30 underline underline-offset-4 hover:text-ink-16"
          >
            Cont și asistenți conectați →
          </Link>
        </div>
      </div>
    </section>
  );
}

function McpFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-mono text-ink-45">{label}</dt>
      <dd className="font-mono-meta mt-1 text-2xl text-ink-16" data-tabular-nums="">
        {value}
      </dd>
    </div>
  );
}

// Discourse-analysis announcement, sibling to McpRegister but visually
// distinct: an open card on the page background (paper-99) framed by a
// heavier ink-16 rule, opposite of MCP's filled paper-96 fill + paper-91
// rule. Visual signature is a 2×2 grid of the four framework cells, each
// labelled in its own framework color (the same palette the speech /
// politician / document / stats pages use). No decorative chrome — the
// schema itself IS the visual.
function DiscourseRegister() {
  return (
    <section aria-labelledby="discurs-public" className="mt-16">
      <div className="border-2 border-ink-16 bg-paper-99 p-6 sm:p-10">
        <p className="label-mono text-ink-30">
          Analiză de discurs <span className="px-1.5 text-ink-45">·</span> Patru cadre publicate
          <span className="px-1.5 text-ink-45">·</span> Marcheri ancorați de text
        </p>

        <h2
          id="discurs-public"
          className="font-display mt-5 max-w-3xl text-2xl leading-[1.15] text-ink-16 sm:text-3xl lg:text-4xl"
        >
          Cum vorbește Parlamentul, citit sub patru cadre publicate.
        </h2>

        <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-30">
          Pe lângă textul stenogramelor, fiecare intervenție substanțială este codată sub patru
          rubrici din literatura de științe politice. Codarea face afirmații despre{" "}
          <em>ce s-a spus</em>, nu despre cine este vorbitorul — fiecare marcher este ancorat de
          fragmentul exact pe care se sprijină și poate fi contestat.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
          <FrameworkCell
            framework="hawkins"
            label="Hawkins · populism"
            description="Cadrul „popor virtuos versus elite corupte”. Detectează maniheismul moral și antagonismul."
          />
          <FrameworkCell
            framework="vparty"
            label="V-Party · anti-pluralism"
            description="Delegitimarea opoziției, justiției sau presei ca instituții. Atac la pluralism."
          />
          <FrameworkCell
            framework="dqi"
            label="DQI · calitate deliberativă"
            description="Justificare substanțială, respect față de adversar, propuneri concrete."
          />
          <FrameworkCell
            framework="voice"
            label="Voce · atribuire"
            description="Vorbitor în nume propriu, citat, parafrazat sau negat — cine vorbește, de fapt."
          />
        </ul>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t border-border pt-6">
          <Button asChild size="lg">
            <Link href="/statistici">Vezi statistici</Link>
          </Button>
          <Link
            href="/despre/discurs"
            className="label-mono text-ink-30 underline underline-offset-4 hover:text-ink-16"
          >
            Metodologia analizei →
          </Link>
        </div>
      </div>
    </section>
  );
}

function FrameworkCell({
  framework,
  label,
  description,
}: {
  framework: DiscourseFramework;
  label: string;
  description: string;
}) {
  return (
    <li className="bg-background p-5">
      <p className={cn("label-mono", FRAMEWORK_FG[framework])}>{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-30">{description}</p>
    </li>
  );
}
