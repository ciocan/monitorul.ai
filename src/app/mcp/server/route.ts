import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import { describeCorpus } from "@/lib/describe-corpus";
import { embedQuery } from "@/lib/embed";
import { ES_INDEX, esClient } from "@/lib/es-client";
import { requestContext, toCatalogueHit, toPersonHit } from "@/lib/mcp-adapters";
import { generalLimiter, heavyLimiter, ipFromRequest } from "@/lib/ratelimit";
import {
  aggSpeechesByPartyYear,
  committeePage,
  committeesIndex,
  getAgendaItem,
  getDocument,
  getReport,
  getSpeech,
  listCommitteeMeetings,
  listDocumentChildren,
  listDocumentsByDate,
  personPage,
  politiciansIndex,
  searchPersons,
  searchSpeeches,
  sessionsIndex,
} from "@/lib/search";
import type { Chamber, MoSpeech, SearchResult } from "@/lib/types";

// =============================================================================
// MCP server — Romanian parliamentary corpus
//
// One thin route handler that registers 16 Zod-typed tools, each a 1:1 wrapper
// over a function in `src/lib/search.ts`. All side-effecting search/lookup
// behaviour lives in the lib layer; this file is only schema + plumbing.
//
// Boundary:
//   - Hosting: Vercel (this Next.js app), `/api/mcp/{mcp,sse}`.
//   - Transport: streamable HTTP (default). SSE disabled — superseded by
//     streamable HTTP per the 2025-03-26 MCP spec.
//   - Rate limit: per-IP sliding window (general + heavy tier for RRF/kNN).
//   - Auth: anonymous V1 (per docs/mcp.md decision matrix; per-key V2).
//
// Tool surface evolves vertically; if you add a tool here, its shape lives in
// `lib/search.ts` first and the cataloguer adapter (when applicable) in
// `lib/mcp-adapters.ts`. This file should never grow ES query bodies.
// =============================================================================

// Streamable-HTTP-only deployment matches the modern spec; the SSE endpoint is
// kept disabled to avoid the legacy two-endpoint dance and the Redis session
// state it requires. Clients negotiating /api/mcp/sse will see a 404 — fine,
// every MCP client built in 2025+ speaks streamable HTTP first.
const DISABLE_SSE = true;

// Public default for substantive-only filtering on speech-shape tools. Mirrors
// the lib-layer `is_substantive: true` default applied across `searchSpeeches`,
// `aggSpeechesByPartyYear`, etc. Surfaced here as a tool param so an LLM can
// widen the universe explicitly when it needs procedural turn-taking too.
const DEFAULT_IS_SUBSTANTIVE = true;

// Romanian inline-filter cheat-sheet, surfaced inside tool descriptions so the
// LLM doesn't need to list_* its way to discover what values to pass. Keep
// this register tight — every kilobyte of tool description costs context the
// model could spend reasoning over results.
//
// Corpus reality: chamber is stored as "Camera Deputaților" / "Senatul"
// (with definite article on the latter). The `Chamber` TS union diverges —
// describe_corpus surfaces the live values so a fresh LLM session always
// reads the truth before filtering.
const CHAMBER_VALUES = `"Camera Deputaților" | "Senatul" (call describe_corpus for live enumeration)`;
const SORT_VALUES = `"relevance" | "date-desc" | "date-asc"`;
const RANK_FUSION_VALUES = `"rrf" | "bm25-only" | "knn-only"`;

// Standardised error shape for tool calls. The streamable-HTTP transport
// surfaces these as the tool's structured result; a 200 OK with `error: ...`
// is preferred over an HTTP 4xx because the MCP client treats transport-level
// errors as fatal (kill the session) while structured errors are just data.
function errorResult(message: string, extra: Record<string, unknown> = {}) {
  return jsonResult({ error: message, ...extra });
}

function jsonResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function notFoundResult(grain: string, id: string) {
  return jsonResult({ found: false, grain, id });
}

// Convert the lib-layer `SearchResult<MoSpeech>` to the cataloguer-mode shape
// returned by `search_speeches`. Drops embedding ballast and bodies in favour
// of pinned URLs + 240ch excerpts.
function speechResultToCatalogue(result: SearchResult<MoSpeech>) {
  const highlights = result.highlights ?? {};
  return {
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
    took_ms: result.tookMs,
    mode: result.mode ?? null,
    hits: result.hits.map((s) => toCatalogueHit(s, highlights[s.record_id])),
  };
}

// kNN-only ablation: bypass `searchSpeechesKnn` (which throws on embed
// failure) and run the kNN leg directly so embed failure becomes "empty
// result" — the diagnostic the doc spells out for this mode.
async function searchSpeechesKnnOnly(params: {
  q: string;
  chamber?: Chamber;
  speakerPersonId?: string;
  years?: number[];
  isSubstantive?: boolean;
  page: number;
  pageSize: number;
}): Promise<{
  hits: MoSpeech[];
  total: number;
  page: number;
  pageSize: number;
  tookMs: number;
  mode: "knn-only";
  degraded: boolean;
}> {
  const vector = await embedQuery(params.q);
  if (!vector) {
    return {
      hits: [],
      total: 0,
      page: params.page,
      pageSize: params.pageSize,
      tookMs: 0,
      mode: "knn-only",
      degraded: true,
    };
  }
  const filters: Array<Record<string, unknown>> = [
    { term: { is_substantive: params.isSubstantive ?? DEFAULT_IS_SUBSTANTIVE } },
  ];
  if (params.chamber) filters.push({ term: { chamber: params.chamber } });
  if (params.speakerPersonId)
    filters.push({ term: { "speaker.person_id": params.speakerPersonId } });
  if (params.years && params.years.length > 0) filters.push({ terms: { year: params.years } });
  const total = params.pageSize * 5;
  const offset = (params.page - 1) * params.pageSize;
  const t0 = performance.now();
  const res = await esClient().search<MoSpeech>({
    index: ES_INDEX.speeches,
    size: total,
    knn: {
      field: "enrichments.embedding",
      query_vector: vector,
      k: total,
      num_candidates: Math.max(100, total * 10),
      filter: filters,
    },
    _source: { excludes: ["enrichments.embedding"] },
  });
  const all = res.hits.hits.flatMap((h) => (h._source ? [h._source] : []));
  return {
    hits: all.slice(offset, offset + params.pageSize),
    total: all.length,
    page: params.page,
    pageSize: params.pageSize,
    tookMs: Math.round(performance.now() - t0),
    mode: "knn-only",
    degraded: false,
  };
}

// =============================================================================
// Handler
// =============================================================================

const handler = createMcpHandler(
  (server) => {
    // -----------------------------------------------------------------------
    // describe_corpus — meta-tool. The LLM should call this once per session
    // to learn the corpus's chambers, topics, reference types, URL templates,
    // counts per grain, and date range. Cheap (~2 ES calls in parallel).
    // -----------------------------------------------------------------------
    server.registerTool(
      "describe_corpus",
      {
        title: "Descrie corpusul",
        description: `Returnează un pachet de auto-iniţializare pentru corpusul parlamentar românesc: camere (${CHAMBER_VALUES}), enumerarea live a topicelor, tipurile de referințe (proiect de lege / lege / cod / OUG / OG / ...), șabloanele URL care duc la link-uri de citare verificabile, totaluri per grain și intervalul de timp acoperit. Apelează acest tool o singură dată la începutul sesiunii, înainte de a compune alte apeluri.`,
        inputSchema: {},
      },
      async () => {
        const description = await describeCorpus();
        return jsonResult(description);
      },
    );

    // -----------------------------------------------------------------------
    // Lookup tools — by-id getters. Return raw lib/search shapes (detail
    // views, not search hits). Null becomes `{ found: false }`.
    // -----------------------------------------------------------------------
    server.registerTool(
      "get_document",
      {
        title: "Adu un document MO",
        description:
          "Aduce un singur document din Monitorul Oficial (un număr / o ședință) după id-ul său `mo://YYYY/PART/ISSUE`. Returnează metadata completă: cameră, dată ședință, tip document, număr de puncte pe ordinea de zi, număr de discursuri și voturi, plus url_path pe acest site. Formatul id-ului este canonic — derivă-l din `record_id` returnat de alte tool-uri, sau construiește-l din an/parte/număr.",
        inputSchema: {
          id: z.string().min(1).describe("Id document, ex. mo://2024/1/123"),
        },
      },
      async ({ id }) => {
        const doc = await getDocument(id);
        if (!doc) return notFoundResult("document", id);
        return jsonResult(doc);
      },
    );

    server.registerTool(
      "get_agenda_item",
      {
        title: "Adu un punct de pe ordinea de zi",
        description:
          "Aduce un singur punct de pe ordinea de zi (unitatea sub care sunt grupate discursurile / voturile dintr-o ședință) după `record_id`. Returnează titlu, ordinal, rezultat, topice principale, referințe (proiecte de lege / legi / coduri) și vorbitorii atașați.",
        inputSchema: {
          id: z.string().min(1).describe("record_id pentru punctul de pe ordinea de zi"),
        },
      },
      async ({ id }) => {
        const item = await getAgendaItem(id);
        if (!item) return notFoundResult("agenda_item", id);
        return jsonResult(item);
      },
    );

    server.registerTool(
      "get_speech",
      {
        title: "Adu un discurs (text integral)",
        description:
          "Aduce un singur discurs după `record_id`, cu textul INTEGRAL. Apelează acest tool ori de câte ori vrei să citezi un fragment verbatim — `search_speeches` returnează doar fragmente de ~240 caractere. Returnează vorbitorul, titlul ordinii de zi, data ședinței, camera și câmpul `text` complet.",
        inputSchema: {
          id: z.string().min(1).describe("record_id pentru discurs"),
        },
      },
      async ({ id }) => {
        const speech = await getSpeech(id);
        if (!speech) return notFoundResult("speech", id);
        return jsonResult(speech);
      },
    );

    server.registerTool(
      "get_report",
      {
        title: "Adu un raport instituțional",
        description:
          "Aduce un singur raport (raport anual, raport de audit etc.) după `record_id`. Returnează instituția emitentă, titlul, perioada de raportare, lista de rubrici și enrichments.",
        inputSchema: {
          id: z.string().min(1).describe("record_id pentru raport"),
        },
      },
      async ({ id }) => {
        const report = await getReport(id);
        if (!report) return notFoundResult("report", id);
        return jsonResult(report);
      },
    );

    server.registerTool(
      "person_page",
      {
        title: "Dosar complet de parlamentar",
        description:
          "Aduce dosarul complet al unei persoane (parlamentar / ministru / președinte de comisie) după slug — același `person_id` returnat în câmpurile speaker ale discursurilor. Returnează înregistrarea canonică (mandate, aliasuri, QID Wikidata), totaluri de discursuri pe an (formă de sparkbar), discursuri recente (paginat), statistici de carieră și un heatmap de activitate. Filtrele opționale `year` și `day` îngustează lista de discursuri.",
        inputSchema: {
          slug: z.string().min(1).describe("Slug-ul persoanei (identic cu person_id)"),
          year: z.number().int().min(1900).max(2100).optional(),
          day: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("YYYY-MM-DD; îngustează lista la o singură ședință"),
          page: z.number().int().min(1).max(100).optional(),
        },
      },
      async ({ slug, year, day, page }) => {
        const payload = await personPage(slug, { year, day, page });
        if (!payload) return notFoundResult("person", slug);
        return jsonResult(payload);
      },
    );

    // -----------------------------------------------------------------------
    // Search tools (cataloguer mode for hit shapes).
    // -----------------------------------------------------------------------
    server.registerTool(
      "search_speeches",
      {
        title: "Caută discursuri",
        description: `Căutare hibridă peste arhiva de discursuri parlamentare. Implicit folosește RRF (Reciprocal Rank Fusion de BM25 + kNN peste vectori BGE-M3) — interoghează tematic, ex. "locuințe" găsește și "imobile" / "spațiu locativ". Filtre: \`speaker_person_id\`, \`chamber\` (${CHAMBER_VALUES}), \`years\` (mai mulți ani), \`date_from\`/\`date_to\`, \`ref_bills\`, \`topics\`, \`speaker_party_raw\`. Sortare: ${SORT_VALUES} — sortările pe dată ocolesc RRF și folosesc BM25-only (ordinea cronologică nu se compune cu ranking-ul semantic). \`is_substantive\` implicit true (filtrează intervențiile procedurale); setează false pentru a include orice intervenție. \`rank_fusion\`: ${RANK_FUSION_VALUES} — \`bm25-only\` pentru substantive proprii / acronime / expresii exacte ("PNRR", "Codul muncii"); \`knn-only\` pentru ablație / debug. Hit-urile sunt fixate la URL-uri absolute verificabile pe monitorul.ai, cu un fragment de 240 caractere; apelează get_speech(record_id) pentru textul integral.`,
        inputSchema: {
          q: z.string().optional().describe("Întrebare în limbaj natural (română)"),
          speaker_person_id: z.string().optional().describe("Filtrează la o singură persoană"),
          chamber: z
            .string()
            .optional()
            .describe(
              'Filtru de cameră — folosește valoarea exactă din corpus ("Camera Deputaților" sau "Senatul"). Apelează întâi describe_corpus pentru enumerarea live.',
            ),
          years: z
            .array(z.number().int().min(1990).max(2100))
            .optional()
            .describe("Filtru pe mai mulți ani; combinate prin SAU"),
          date_from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("Limita inferioară a ferestrei de dată (YYYY-MM-DD)"),
          date_to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("Limita superioară a ferestrei de dată (YYYY-MM-DD)"),
          ref_bills: z
            .array(z.string())
            .optional()
            .describe("Filtrează la discursurile care fac referire la aceste proiecte de lege"),
          topics: z.array(z.string()).optional().describe("Filtru pe slug-uri de topic"),
          speaker_party_raw: z
            .array(z.string())
            .optional()
            .describe(
              "Valori brute pentru party_group_at_time (la momentul intervenției); combinate prin SAU",
            ),
          is_substantive: z
            .boolean()
            .optional()
            .describe("Implicit true. Setează false pentru a include intervenții procedurale."),
          page: z.number().int().min(1).max(100).optional().describe("Pagina (1-indexat)"),
          page_size: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe("Dimensiunea paginii (max. 50)"),
          rank_fusion: z.enum(["rrf", "bm25-only", "knn-only"]).optional(),
          sort: z.enum(["relevance", "date-desc", "date-asc"]).optional(),
        },
      },
      async (args) => {
        const page = args.page ?? 1;
        const pageSize = Math.min(args.page_size ?? 20, 50);
        const requestedFusion = args.rank_fusion ?? "rrf";
        if (requestedFusion === "knn-only") {
          const q = args.q?.trim();
          if (!q) {
            return errorResult(
              "search_speeches în mod knn-only necesită un q nevid. Trimite o interogare textuală.",
            );
          }
          const knn = await searchSpeechesKnnOnly({
            q,
            chamber: args.chamber as Chamber | undefined,
            speakerPersonId: args.speaker_person_id,
            years: args.years,
            isSubstantive: args.is_substantive,
            page,
            pageSize,
          });
          const fakeResult: SearchResult<MoSpeech> = {
            hits: knn.hits,
            total: knn.total,
            page: knn.page,
            pageSize: knn.pageSize,
            tookMs: knn.tookMs,
            mode: "rrf",
          };
          return jsonResult({
            ...speechResultToCatalogue(fakeResult),
            mode: "knn-only",
            degraded: knn.degraded,
          });
        }
        const result = await searchSpeeches({
          q: args.q,
          speakerPersonId: args.speaker_person_id,
          // Chamber is stored verbatim ("Camera Deputaților" / "Senatul") and
          // matched as a `term` filter; pass the user's literal through. The
          // `as Chamber` cast acknowledges the lib type is narrower than the
          // corpus reality.
          chamber: args.chamber as Chamber | undefined,
          years: args.years,
          dateFrom: args.date_from,
          dateTo: args.date_to,
          refBills: args.ref_bills,
          topics: args.topics,
          speakerPartyRaw: args.speaker_party_raw,
          isSubstantive: args.is_substantive,
          page,
          pageSize,
          rankFusion: requestedFusion,
          sort: args.sort,
        });
        // `degraded` surfaces when RRF was requested but the embed service was
        // unreachable and the layer fell back to BM25-only. Equivalent to
        // `mode === "bm25-only"` when the caller asked for `rrf`.
        const degraded = requestedFusion === "rrf" && result.mode === "bm25-only";
        return jsonResult({ ...speechResultToCatalogue(result), degraded });
      },
    );

    server.registerTool(
      "search_persons",
      {
        title: "Caută persoane",
        description:
          "Căutare fuzzy după nume, peste parlamentari, miniștri și președinți de comisii. Insensibilă la diacritice (`sosoaca` găsește `Șoșoacă`). Returnează înregistrarea canonică a persoanei și un URL verificabil pe monitorul.ai. Folosește acest tool pentru a rezolva un nume către `person_id` / `slug`, înainte de a apela `person_page` sau de a filtra `search_speeches` cu `speaker_person_id`.",
        inputSchema: {
          q: z.string().min(1).describe("Nume (română; insensibilă la diacritice)"),
          page_size: z.number().int().min(1).max(50).optional(),
          prefix: z
            .boolean()
            .optional()
            .describe("Tratează ultimul token ca prefix (formă de autocomplete)"),
        },
      },
      async (args) => {
        const persons = await searchPersons(args.q, {
          pageSize: args.page_size,
          prefix: args.prefix,
        });
        return jsonResult({ hits: persons.map(toPersonHit) });
      },
    );

    // -----------------------------------------------------------------------
    // List tools — full-document playback + by-date / by-committee browsing.
    // -----------------------------------------------------------------------
    server.registerTool(
      "list_document_children",
      {
        title: "Listează conținutul unui document MO",
        description:
          "Listează toate înregistrările-copil (puncte de pe ordinea de zi, discursuri, voturi, interpelări, întrebări, ședințe de comisie) dintr-un document MO, sortate după `position_in_document` ASC — redarea completă a documentului în ordinea sursei. Plafonată la 500. Returnează o listă plată, cu un discriminator `grain` pe fiecare element.",
        inputSchema: {
          document_id: z.string().min(1).describe("Id document (mo://YYYY/PART/ISSUE)"),
        },
      },
      async ({ document_id }) => {
        const payload = await listDocumentChildren(document_id);
        return jsonResult(payload);
      },
    );

    server.registerTool(
      "list_documents_by_date",
      {
        title: "Listează documentele dintr-o anumită zi",
        description: `Returnează toate documentele MO cu o anumită dată de ședință, opțional filtrate pe cameră (${CHAMBER_VALUES}). Util pentru "redă ședința de ieri" sau "ce s-a întâmplat pe data X".`,
        inputSchema: {
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .describe("YYYY-MM-DD"),
          chamber: z.string().optional().describe("Filtru opțional de cameră"),
        },
      },
      async ({ date, chamber }) => {
        const docs = await listDocumentsByDate(date, chamber as Chamber | undefined);
        return jsonResult({ documents: docs });
      },
    );

    server.registerTool(
      "list_committee_meetings",
      {
        title: "Listează ședințele unei comisii",
        description:
          "Returnează toate ședințele unei comisii, sortate descrescător după meeting_date. Plafonată la 50 per apel. `date_from` (YYYY-MM-DD) opțional. Folosește `committees_index` pentru a descoperi committee_id-urile disponibile.",
        inputSchema: {
          committee_id: z.string().min(1).describe("Id-ul comisiei"),
          date_from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("Limită inferioară opțională (YYYY-MM-DD)"),
        },
      },
      async ({ committee_id, date_from }) => {
        const meetings = await listCommitteeMeetings(committee_id, date_from);
        return jsonResult({ meetings });
      },
    );

    // -----------------------------------------------------------------------
    // Index / directory tools — page-shaped registries.
    // -----------------------------------------------------------------------
    server.registerTool(
      "politicians_index",
      {
        title: "Top parlamentari pentru un an",
        description:
          "Top 100 parlamentari după numărul de discursuri pentru anul selectat (implicit ultimul an activ), plus totalurile per an pentru sparkbar. Setează `mode=all` pentru a include intervențiile procedurale; valoarea implicită `substantive` filtrează doar discursurile substanțiale — același contract ca pagina publică /politicieni.",
        inputSchema: {
          year: z.number().int().min(1990).max(2100).optional().describe("Anul vizat"),
          mode: z.enum(["substantive", "all"]).optional(),
        },
      },
      async ({ year, mode }) => {
        const payload = await politiciansIndex({
          year,
          substantiveOnly: mode !== "all",
        });
        return jsonResult(payload);
      },
    );

    server.registerTool(
      "committees_index",
      {
        title: "Top comisii pentru un an",
        description:
          "Top 100 comisii după numărul de ședințe pentru anul selectat (implicit ultimul an activ), plus totalurile per an pentru sparkbar. Comisiile fără ședințe indexate sunt invizibile — registrul este derivat live din `mo-committee-meetings`.",
        inputSchema: {
          year: z.number().int().min(1990).max(2100).optional().describe("Anul vizat"),
        },
      },
      async ({ year }) => {
        const payload = await committeesIndex({ year });
        return jsonResult(payload);
      },
    );

    server.registerTool(
      "sessions_index",
      {
        title: "Sesiuni pe an",
        description:
          "Totaluri de ședințe per an pe toată arhiva, plus lista de documente pentru anul selectat (implicit ultimul an activ), sortată descrescător după session_date. Cel mai dens an se încadrează în plafonul de 500 documente.",
        inputSchema: {
          year: z.number().int().min(1990).max(2100).optional().describe("Anul vizat"),
        },
      },
      async ({ year }) => {
        const payload = await sessionsIndex({ year });
        return jsonResult(payload);
      },
    );

    server.registerTool(
      "committee_page",
      {
        title: "Dosar de comisie",
        description:
          "Dosarul unei comisii: antet (nume + tip + comisii reunite), sparkbar de ședințe per an, plus lista de ședințe pentru anul selectat (plafon 50). Returnează `null` când committee_id nu are nicio ședință înregistrată.",
        inputSchema: {
          committee_id: z.string().min(1).describe("Id-ul comisiei"),
          year: z.number().int().min(1990).max(2100).optional().describe("Anul vizat"),
        },
      },
      async ({ committee_id, year }) => {
        const payload = await committeePage(committee_id, { year });
        if (!payload) return notFoundResult("committee", committee_id);
        return jsonResult(payload);
      },
    );

    // -----------------------------------------------------------------------
    // Aggregation tool.
    // -----------------------------------------------------------------------
    server.registerTool(
      "agg_speeches_by_party_year",
      {
        title: "Agregă discursurile substanțiale partid × an",
        description: `Returnează o listă plată de triplete \`{ party, year, count }\`. Restricționată mereu la discursuri substanțiale (intervențiile procedurale sunt excluse). Filtrele opționale \`year\` și \`chamber\` (${CHAMBER_VALUES}) îngustează bucket-urile. Plafoane: 100 partide × 100 ani.`,
        inputSchema: {
          year: z.number().int().min(1990).max(2100).optional().describe("Anul vizat"),
          chamber: z.string().optional().describe("Filtru opțional de cameră"),
        },
      },
      async ({ year, chamber }) => {
        const buckets = await aggSpeechesByPartyYear({
          year,
          chamber: chamber as Chamber | undefined,
        });
        return jsonResult({ buckets });
      },
    );
  },
  // Server options — name + version surface to MCP clients (Claude Desktop's
  // tool-call panel shows these). Bump version when the tool surface gains a
  // breaking change.
  {
    serverInfo: {
      name: "monitorul-ai",
      version: "1.0.0",
    },
  },
  {
    // mcp-handler dispatches by matching `req.url.pathname` against the
    // configured streamable-HTTP endpoint (a full pathname, not relative to
    // basePath). The route file lives at `src/app/mcp/server/route.ts`, so
    // Next.js routes `/mcp/server` to it; we tell mcp-handler the same path
    // so the comparison succeeds. Moving the file requires updating both.
    streamableHttpEndpoint: "/mcp/server",
    // Keep the per-request budget loose — RRF + embed + ES round-trips can
    // total ~3s on cold cache. The default 60s is plenty.
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
    disableSse: DISABLE_SSE,
  },
);

// Resolve the public-facing origin from request headers, in this precedence
// order: explicit `X-Forwarded-Host` + `X-Forwarded-Proto` (set by Vercel /
// most reverse proxies), then RFC 7239 `Forwarded`, then the `Host` header
// over the request's protocol, then the absolute `req.url`. The fallback is
// the build-time env value — used for tests / non-HTTP invocations.
//
// The cataloguer reads this via `requestContext` (AsyncLocalStorage) so every
// `absolute_url` in tool results round-trips on the host the client is
// actually hitting (localhost:3020, an ngrok URL, prod monitorul.ai, …).
function resolvePublicOrigin(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const xfProto = req.headers.get("x-forwarded-proto");
  if (xfHost) {
    const proto = xfProto?.split(",")[0]?.trim() ?? "https";
    return `${proto}://${xfHost.split(",")[0]?.trim()}`;
  }
  const forwarded = req.headers.get("forwarded");
  if (forwarded) {
    const hostMatch = /host="?([^;",]+)"?/i.exec(forwarded);
    const protoMatch = /proto="?([^;",]+)"?/i.exec(forwarded);
    if (hostMatch?.[1]) {
      const proto = protoMatch?.[1] ?? "https";
      return `${proto}://${hostMatch[1]}`;
    }
  }
  const host = req.headers.get("host");
  if (host) {
    // Heuristic: localhost is always http, public hosts default https. The
    // client may still set X-Forwarded-Proto if the truth is more nuanced.
    const isLocal =
      host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
    return `${isLocal ? "http" : "https"}://${host}`;
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

// Wrap the handler with rate limiting + IP extraction. Heavy tier targets
// `search_speeches` only when `rank_fusion ∈ {rrf, knn-only}` — the modes that
// hit the embed service. The general tier covers everything else. We can't
// inspect the parsed tool-call body without pre-buffering the request stream,
// so we rate-limit on the request body when we can read it (POST /api/mcp/mcp)
// and otherwise fall back to general-tier only.
async function handlerWithRateLimit(req: Request): Promise<Response> {
  const ip = ipFromRequest(req);
  const origin = resolvePublicOrigin(req);
  const general = await generalLimiter().limit(`g:${ip}`);
  if (!general.success) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded (general).",
        limit: general.limit,
        retry_after_ms: Math.max(0, general.reset - Date.now()),
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": Math.ceil(Math.max(0, general.reset - Date.now()) / 1000).toString(),
        },
      },
    );
  }
  // Heavy-tier sniff: peek at the body without consuming it. Streamable HTTP
  // sends JSON-RPC; we look at the parsed `params.name` / `params.arguments`
  // shape. If body parsing fails (non-JSON, GET request), skip the heavy gate.
  // Same pass extracts the tool name so we can stamp `requestContext.tool`
  // for query-log attribution downstream.
  let cloned: Request = req;
  let toolName: string | undefined;
  if (req.method === "POST") {
    try {
      const body = await req.clone().text();
      if (body) {
        const parsed = JSON.parse(body) as {
          method?: string;
          params?: { name?: string; arguments?: { rank_fusion?: string } };
        };
        const isToolsCall = parsed.method === "tools/call";
        toolName = isToolsCall ? parsed.params?.name : undefined;
        const fusion = parsed.params?.arguments?.rank_fusion;
        const isHeavy =
          isToolsCall &&
          toolName === "search_speeches" &&
          (fusion === "rrf" || fusion === "knn-only" || fusion === undefined);
        if (isHeavy) {
          const heavy = await heavyLimiter().limit(`h:${ip}`);
          if (!heavy.success) {
            return new Response(
              JSON.stringify({
                error: "Rate limit exceeded (heavy: RRF/kNN search_speeches).",
                limit: heavy.limit,
                retry_after_ms: Math.max(0, heavy.reset - Date.now()),
              }),
              {
                status: 429,
                headers: {
                  "content-type": "application/json",
                  "retry-after": Math.ceil(Math.max(0, heavy.reset - Date.now()) / 1000).toString(),
                },
              },
            );
          }
        }
      }
      // Reconstruct the request with the body still readable downstream.
      cloned = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body,
      });
    } catch {
      // Body unreadable (binary, malformed) — let the handler reject it
      // downstream. We've still applied the general limiter.
    }
  }
  // Run the actual handler inside the per-request scope. `origin` reaches the
  // cataloguer adapter (absolute URLs round-trip on the actual host); `surface`
  // and `tool` reach `lib/search.ts.logQuery` so each row in `mo_query_log`
  // carries the entry-point attribution.
  return requestContext.run({ origin, surface: "mcp", tool: toolName }, () => handler(cloned));
}

export const GET = handlerWithRateLimit;
export const POST = handlerWithRateLimit;
export const DELETE = handlerWithRateLimit;
