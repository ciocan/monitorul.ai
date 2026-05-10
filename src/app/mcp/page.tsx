import type { Metadata } from "next";
import Link from "next/link";

import { Dateline } from "@/components/dateline";
import { McpConfigBlock } from "@/components/mcp-config-block";
import { McpEndpointCopyButton, McpEndpointUrl } from "@/components/mcp-endpoint-url";
import { env } from "@/env";

// Public-facing presentation page for the MCP server. Sits at /mcp; the
// actual streamable-HTTP endpoint is /mcp/server (rewritten in next.config.ts
// to /api/mcp/[transport]/route.ts with transport="mcp"). The page is what a
// human reads to learn what the service is and how to plug it into their AI
// client. ISR 1h, JSON-LD WebAPI.
export const revalidate = 3600;

const TITLE = "MCP — Server pentru asistenți AI";
const DESCRIPTION =
  "Server public pentru protocolul Model Context Protocol. Permite oricărui asistent AI (Claude Desktop, Cursor, Codex, claude.ai) să interogheze corpusul parlamentar românesc cu citate verificabile, autentificat cu Google.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/mcp" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    locale: "ro_RO",
    url: "/mcp",
  },
};

const ENDPOINT_PATH = "/mcp/server";
const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
const ENDPOINT_URL = `${SITE_URL}${ENDPOINT_PATH}`;

interface ToolRow {
  name: string;
  purpose: string;
}

const TOOLS_LOOKUP: ToolRow[] = [
  { name: "describe_corpus", purpose: "Camere, topice, tipuri de referințe, intervale, totaluri" },
  { name: "get_document", purpose: "Un număr al MO după mo://YYYY/PART/ISSUE" },
  { name: "get_agenda_item", purpose: "Un punct de pe ordinea de zi" },
  { name: "get_speech", purpose: "Un discurs cu textul integral (pentru citate)" },
  { name: "get_report", purpose: "Un raport instituțional" },
  { name: "person_page", purpose: "Dosar complet pentru un parlamentar" },
  { name: "committee_page", purpose: "Dosar complet pentru o comisie" },
];

const TOOLS_SEARCH: ToolRow[] = [
  { name: "search_speeches", purpose: "Căutare hibridă (BM25 + kNN/RRF) peste discursuri" },
  { name: "search_persons", purpose: "Căutare fuzzy de parlamentari, miniștri, președinți" },
];

const TOOLS_LIST: ToolRow[] = [
  {
    name: "list_document_children",
    purpose: "Toate înregistrările dintr-un număr al MO, în ordine",
  },
  { name: "list_documents_by_date", purpose: "Ședințele de pe o anumită dată" },
  { name: "list_committee_meetings", purpose: "Ședințele unei comisii" },
];

const TOOLS_INDEX: ToolRow[] = [
  { name: "politicians_index", purpose: "Top 100 parlamentari pentru un an" },
  { name: "committees_index", purpose: "Top 100 comisii pentru un an" },
  { name: "sessions_index", purpose: "Toate ședințele dintr-un an" },
  { name: "agg_speeches_by_party_year", purpose: "Agregare partid × an" },
];

interface TocItem {
  id: string;
  label: string;
}

const TOC: TocItem[] = [
  { id: "ce-este", label: "Ce este MCP" },
  { id: "endpoint", label: "Endpoint și conectare" },
  { id: "prima-conectare", label: "Prima conectare" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor și Cline" },
  { id: "codex", label: "Codex CLI" },
  { id: "instrumente", label: "Cele 16 instrumente" },
  { id: "exemple", label: "Întrebări tipice" },
  { id: "limite", label: "Limite și costuri" },
  { id: "metodologie", label: "Metodologie și sursă" },
];

export default function McpPage() {
  return (
    <article className="mx-auto w-full max-w-(--breakpoint-lg) px-6 py-12 sm:py-16">
      <McpJsonLd />

      <Dateline parts={["Server MCP", "Monitorul.ai", "Acces public · Google OAuth"]} />

      <header className="mt-6 border-b border-border pb-10">
        <h1 className="font-display text-4xl leading-[1.05] text-ink-16 sm:text-5xl lg:text-6xl">
          {TITLE}
        </h1>
        <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-30">
          monitorul.ai expune corpusul parlamentar (818 mii de discursuri din ședințele Camerei și
          Senatului din 2000 încoace) ca server <em>Model Context Protocol</em>. Orice asistent AI
          care vorbește MCP poate cere date direct din arhivă: căutare după nume sau temă, dosare de
          parlamentar, agregări, redarea unei ședințe întregi. Răspunsurile vin cu link-uri
          verificabile pe acest site.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="label-mono text-ink-30">Endpoint</h2>
        <div className="mt-3 flex items-stretch overflow-hidden border border-border bg-paper-96">
          <code className="flex-1 truncate px-4 py-3 font-mono text-sm text-ink-16 sm:text-base">
            <McpEndpointUrl fallback={ENDPOINT_URL} />
          </code>
          <McpEndpointCopyButton fallback={ENDPOINT_URL} className="border-l border-border" />
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-45">
          Streamable HTTP, autentificat cu OAuth 2.0 (Google). La prima conectare asistentul îți
          deschide o fereastră de browser pentru autentificare; conectările următoare sunt
          silențioase până la revocare din{" "}
          <Link href="/cont" className="underline underline-offset-4 hover:text-ink-16">
            /cont
          </Link>
          . Limita: 30 cereri/min per cont și per IP; 6 cereri/min pentru căutare hibridă (RRF /
          kNN-only). Vezi{" "}
          <a href="#limite" className="underline underline-offset-4 hover:text-ink-16">
            Limite și costuri
          </a>
          .
        </p>
      </section>

      <nav aria-labelledby="cuprins" className="mt-10 border-y border-border py-8">
        <h2 id="cuprins" className="label-mono text-ink-30">
          Cuprins
        </h2>
        <ol className="mt-4 grid gap-x-12 gap-y-2 sm:grid-cols-2 [counter-reset:toc]">
          {TOC.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline gap-3 [counter-increment:toc] before:font-mono before:text-xs before:text-ink-45 before:content-[counter(toc,decimal-leading-zero)]"
            >
              <a
                href={`#${item.id}`}
                className="text-base text-ink-16 underline-offset-4 hover:underline"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="ce-este" title="Ce este MCP">
        <p>
          Model Context Protocol (MCP) este un protocol deschis prin care asistenții AI primesc
          acces la surse de date și la instrumente externe. Un server MCP nu este un chatbot — este
          un strat de date pe care îl deschizi pentru orice client compatibil. Asistentul vede o
          listă de instrumente, decide singur care îi trebuie pentru o întrebare anume, și
          construiește răspunsul din rezultatele acelor instrumente.
        </p>
        <p>
          Acest server expune <strong>16 instrumente</strong>, toate citindu-se din aceeași bază de
          date Elasticsearch care alimentează website-ul. Nu este un strat redundant: site-ul și
          serverul MCP sunt două interfețe peste același corpus, cu aceleași identificatoare stabile
          și aceleași URL-uri canonice.
        </p>
      </Section>

      <Section id="endpoint" title="Endpoint și conectare">
        <p>
          Pentru orice client MCP modern, conectarea înseamnă să-i dai URL-ul de mai sus. Clientul
          face un handshake (<code>initialize</code>), descoperă serverul de autorizare prin{" "}
          <code>/.well-known/oauth-protected-resource</code>, parcurge dansul OAuth 2.0 cu PKCE și
          DCR, citește lista de instrumente (<code>tools/list</code>), apoi le invocă pe rând (
          <code>tools/call</code>). Toată conversația se întâmplă peste HTTP cu transport{" "}
          <em>streamable HTTP</em>.
        </p>
        <p>
          Configurația din clientul tău rămâne aceeași indiferent de autentificare —{" "}
          <code>mcp-remote</code> (învelișul <code>npx</code> pe care îl recomandăm pentru Claude
          Desktop și Codex) gestionează transparent fluxul OAuth: îți deschide o fereastră de
          browser la prima cerere, salvează cheile local, le reîmprospătează când expiră.
        </p>
      </Section>

      <Section id="prima-conectare" title="Prima conectare">
        <p>Pașii pe care îi vezi în browser, în ordine:</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink-30 marker:text-ink-45">
          <li>
            Asistentul deschide o fereastră de browser cu URL-ul de autorizare al monitorul.ai.
          </li>
          <li>
            Dacă nu ești autentificat, te trimitem la{" "}
            <Link href="/cont/intra" className="underline underline-offset-4 hover:text-ink-16">
              /cont/intra
            </Link>
            . Apeși <em>Conectare cu Google</em> și treci prin selecția standard de cont Google.
          </li>
          <li>
            După autentificare, îți afișăm un ecran de consimțământ care arată numele asistentului,
            URL-ul lui de redirect și ce permisiuni cere. Apeși <em>Acceptă și conectează</em>.
          </li>
          <li>
            Browserul închide fereastra (sau te lasă să o închizi tu) și asistentul are de acum o
            cheie de acces și o cheie de reîmprospătare.
          </li>
        </ol>
        <p className="mt-4">
          Conectările ulterioare sunt silențioase — atâta timp cât nu revoci accesul din{" "}
          <Link href="/cont" className="underline underline-offset-4 hover:text-ink-16">
            /cont
          </Link>
          , <code>mcp-remote</code> își reîmprospătează automat cheia când expiră (la ~24 ore) și
          asistentul tău nu observă niciodată că autentificarea s-a întâmplat.
        </p>
      </Section>

      <Section id="claude-desktop" title="Claude Desktop">
        <p>Adaugă serverul în fișierul de configurare al aplicației:</p>
        <McpConfigBlock
          path="~/Library/Application Support/Claude/claude_desktop_config.json (macOS)"
          alt="%APPDATA%\Claude\claude_desktop_config.json (Windows)"
          serverKey="mcpServers"
          fallback={ENDPOINT_URL}
        />
        <p>
          Repornește Claude Desktop. Iconița de instrumente (ciocanul) ar trebui să afișeze cele 16
          tool-uri sub <code>monitorul-ai</code>. Pentru o conversație de testare:{" "}
          <em>„Folosește monitorul-ai: ce a spus Diana Șoșoacă despre vaccinuri în 2021?”</em>
        </p>
      </Section>

      <Section id="cursor" title="Cursor și Cline">
        <p>
          Atât Cursor cât și Cline acceptă URL-ul serverului direct, fără proxy. În setările MCP ale
          clientului, alege <em>Add server</em>, transportul <em>streamable-http</em> sau{" "}
          <em>http</em>, și introdu:
        </p>
        <div className="mt-3 flex items-stretch overflow-hidden border border-border bg-paper-96">
          <code className="flex-1 truncate px-4 py-3 font-mono text-sm text-ink-16">
            <McpEndpointUrl fallback={ENDPOINT_URL} />
          </code>
          <McpEndpointCopyButton fallback={ENDPOINT_URL} className="border-l border-border" />
        </div>
      </Section>

      <Section id="codex" title="Codex CLI">
        <p>
          Codex acceptă același tip de configurare ca Claude Desktop, prin <code>mcp-remote</code>:
        </p>
        <McpConfigBlock
          path="~/.codex/config.toml"
          serverKey="mcp_servers"
          fallback={ENDPOINT_URL}
        />
      </Section>

      <Section id="instrumente" title="Cele 16 instrumente">
        <p>
          Surfaceul este organizat pe patru funcții: identificare unică (lookup), căutare, listare,
          și agregări. Fiecare instrument este un wrapper Zod-tipat peste o funcție din stratul de
          acces ES — same shape, same caps, same defaults ca pe site.
        </p>
        <ToolGroup label="Lookup — extragere după id" tools={TOOLS_LOOKUP} />
        <ToolGroup label="Search — căutare cu evidențiere" tools={TOOLS_SEARCH} />
        <ToolGroup label="List — listare în ordine" tools={TOOLS_LIST} />
        <ToolGroup label="Index și agregări" tools={TOOLS_INDEX} />
      </Section>

      <Section id="exemple" title="Întrebări tipice">
        <p>
          Compoziția e treaba asistentului — el alege ce tool-uri să apeleze și în ce ordine. Câteva
          tipare de întrebare care merg bine:
        </p>
        <ul className="mt-4 space-y-3 text-base leading-relaxed text-ink-30">
          <li>
            <em>„Ce a spus George Simion despre UE în 2024?”</em>
            <span className="block text-sm text-ink-45">
              search_persons → search_speeches cu speaker_person_id și years
            </span>
          </li>
          <li>
            <em>„Redă întreaga ședință a Senatului de ieri.”</em>
            <span className="block text-sm text-ink-45">
              list_documents_by_date → list_document_children
            </span>
          </li>
          <li>
            <em>„Cine a vorbit cel mai mult despre locuințe în 2024?”</em>
            <span className="block text-sm text-ink-45">
              search_speeches cu q + agg_speeches_by_party_year pentru cohorte
            </span>
          </li>
          <li>
            <em>„Construiește un dosar pe senatorul X.”</em>
            <span className="block text-sm text-ink-45">
              search_persons → person_page → search_speeches filtrat pe persoană
            </span>
          </li>
          <li>
            <em>„Caută toate intervențiile care fac referire la Codul muncii.”</em>
            <span className="block text-sm text-ink-45">
              search_speeches cu rank_fusion=&quot;bm25-only&quot; pentru exactitate
            </span>
          </li>
        </ul>
      </Section>

      <Section id="limite" title="Limite și costuri">
        <p>
          Serverul este public și gratuit. Aplicăm rate-limit pe două axe (per cont și per IP) și în
          două nivele de strictețe (general și greu pentru căutarea hibridă). Cererile trebuie să
          treacă pe ambele axe — așa o cheie scursă peste mai multe IP-uri și un IP împărțit de mai
          multe conturi sunt limitate independent.
        </p>
        <ul className="mt-4 space-y-2 text-base leading-relaxed text-ink-30">
          <li>
            <strong>30 cereri / minut / cont</strong> și <strong>30 cereri / minut / IP</strong> —
            orice apel de tool. Suficient pentru conversații normale, inclusiv lanțuri de tool-uri
            în care asistentul rulează 5–10 apeluri pe rând.
          </li>
          <li>
            <strong>6 cereri / minut / cont</strong> și <strong>6 cereri / minut / IP</strong> —
            căutare hibridă cu RRF sau kNN. Aceste apeluri ating serviciul de embeddings; limita
            strânsă previne folosirea disproporționată.
          </li>
        </ul>
        <p>
          Cheile de acces durează ~24 ore; cheile de reîmprospătare ~30 zile sau până la revocare
          din{" "}
          <Link href="/cont" className="underline underline-offset-4 hover:text-ink-16">
            /cont
          </Link>
          . Răspunsurile la căutare sunt în <em>cataloguer mode</em>: hit-urile vin cu
          identificator, URL absolut verificabil, fragment de 240 de caractere și metadata
          vorbitorului. Textul integral al unui discurs se cere separat prin{" "}
          <code>get_speech(record_id)</code> — în felul acesta o conversație lungă se încadrează în
          context window-ul asistentului fără paginări inutile.
        </p>
      </Section>

      <Section id="metodologie" title="Metodologie și sursă">
        <p>
          Datele și URL-urile sunt aceleași ca pe site. Pentru detalii despre pipeline, identitatea
          înregistrărilor și algoritmul de căutare, vezi{" "}
          <Link href="/despre" className="underline underline-offset-4 hover:text-ink-16">
            nota metodologică
          </Link>
          . Pentru contractul tehnic complet al MCP-ului (forma hit-urilor, modurile de fuziune,
          tier-urile de rate-limit, planuri V2), vezi{" "}
          <a
            href="https://github.com/ciocan/monitorul.ai/blob/main/docs/mcp.md"
            className="underline underline-offset-4 hover:text-ink-16"
            rel="noreferrer"
            target="_blank"
          >
            docs/mcp.md
          </a>{" "}
          în repo.
        </p>
        <p>
          <Link href="/despre#corectii" className="underline underline-offset-4 hover:text-ink-16">
            Erori sau lacune în corpus
          </Link>{" "}
          pot fi semnalate prin canalele descrise în nota metodologică. Sursa primară rămâne
          Monitorul Oficial; arhiva este un strat de citare și descoperire peste documentele
          publice.
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
    <section id={id} className="mt-12 border-b border-border pb-10 last:border-b-0">
      <h2 className="font-display text-2xl text-ink-16 sm:text-3xl">{title}</h2>
      <div className="mt-4 max-w-prose space-y-4 text-base leading-relaxed text-ink-30">
        {children}
      </div>
    </section>
  );
}

function ToolGroup({ label, tools }: { label: string; tools: ToolRow[] }) {
  return (
    <div className="mt-6">
      <h3 className="label-mono text-ink-45">{label}</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {tools.map((t) => (
          <div key={t.name} className="contents">
            <dt className="font-mono text-sm text-ink-16">{t.name}</dt>
            <dd className="text-sm text-ink-30">{t.purpose}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function McpJsonLd() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: "monitorul.ai MCP server",
    description: DESCRIPTION,
    url: ENDPOINT_URL,
    documentation: `${SITE_URL}/mcp`,
    provider: {
      "@type": "Organization",
      name: "monitorul.ai",
      url: SITE_URL,
    },
    // Free of charge but auth-gated. `false` is the schema.org-correct
    // shape for "requires login"; the server is still gratis once you've
    // authenticated.
    isAccessibleForFree: false,
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
  );
}
