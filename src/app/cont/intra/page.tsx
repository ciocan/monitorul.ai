import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SigninViewedTracker } from "@/components/analytics/page-trackers";
import { McpOauthStartedForm } from "@/components/analytics/tracked-submit";
import { Dateline } from "@/components/dateline";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

import { signInWithGoogle } from "../actions";

// Sign-in surface. Lives at /cont/intra (Romanian "intră" — enter).
// Reachable via:
//   - a direct /cont visit when no session exists (page redirects here)
//   - the MCP plugin's `loginPage` redirect during the OAuth dance
//     (the consent flow lands here when no session, then bounces back)
//   - the site-header chip's "Intră" link
//
// `noindex` because it's a transient auth surface — search engines should
// land on `/cont` once a user has a session, and on `/mcp` for the public
// presentation page.
export const metadata: Metadata = {
  title: "Intră în cont — monitorul.ai",
  description: "Autentificare cu Google pentru a folosi serverul MCP monitorul.ai.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cont/intra" },
};

interface PageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function ContIntraPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  // Honour ?next=/path for in-flow redirects (the OIDC consent dance lands
  // here with the consent route as ?next=…). Cap to local paths so a
  // crafted URL can't bounce the user off-site after sign-in.
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/cont";
  if (session) redirect(next);

  // When the user is in an MCP DCR flow, `next` is /cont/consimt?... and
  // carries the requesting client's id — resolve the application name so
  // PostHog gets the public-facing client_name on `mcp_oauth_started`.
  // Outside the DCR flow (direct /cont visit), skip the lookup entirely.
  const dcrClientName = next.startsWith("/cont/consimt") ? await resolveDcrClientName(next) : null;

  return (
    <article className="mx-auto w-full max-w-prose px-6 py-12 sm:py-16">
      <SigninViewedTracker in_oauth_flow={dcrClientName !== null} />
      <Dateline parts={["Cont", "Autentificare", "Monitorul.ai"]} />
      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-[1.05] text-ink-16 sm:text-5xl">
          Intră în cont
        </h1>
        <p className="mt-6 text-base leading-relaxed text-ink-30">
          Serverul MCP <code>monitorul.ai</code> este public și gratuit, dar protejat de un strat de
          autentificare: îți dă o identitate stabilă pe care o folosim ca să prevenim abuzul. Pe
          asistenții AI care vorbesc OAuth, conectarea durează un singur clic — la prima utilizare.
        </p>
      </header>

      <section className="mt-10">
        {dcrClientName !== null ? (
          <McpOauthStartedForm action={signInWithGoogle} clientName={dcrClientName}>
            <input type="hidden" name="callbackURL" value={next} />
            <Button type="submit" size="lg" variant="default" className="w-full sm:w-auto">
              Conectare cu Google
            </Button>
          </McpOauthStartedForm>
        ) : (
          <form action={signInWithGoogle}>
            <input type="hidden" name="callbackURL" value={next} />
            <Button type="submit" size="lg" variant="default" className="w-full sm:w-auto">
              Conectare cu Google
            </Button>
          </form>
        )}
        <p className="mt-4 text-sm leading-relaxed text-ink-45">
          Singurul provider acceptat în prima versiune. Dacă ai nevoie de altă metodă (cont
          instituțional, parolă etc.), trimite-ne un mesaj la{" "}
          <a
            href="mailto:radu@monitorul.ai"
            className="underline underline-offset-4 hover:text-ink-16"
          >
            radu@monitorul.ai
          </a>
          .
        </p>
      </section>

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="label-mono text-ink-30">Ce stocăm despre tine</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-30">
          <li>Adresa de e-mail și ID-ul de cont Google — necesare pentru autentificare.</li>
          <li>
            Lista asistenților AI conectați și momentul fiecărei conectări — vizibilă în pagina ta
            de cont la <code>/cont</code>.
          </li>
          <li>
            Atribuim cererile pe care le faci prin MCP la contul tău, pentru limitare de rată și
            diagnoză a abuzului. Vezi nota metodologică la{" "}
            <Link href="/despre" className="underline underline-offset-4 hover:text-ink-16">
              /despre
            </Link>
            .
          </li>
        </ul>
      </section>
    </article>
  );
}

// Pull the requesting OAuth application's display name from the consent
// URL. Returns `"Asistent fără nume"` when the client_id is missing or
// the DB lookup yields nothing — the event still fires so the funnel
// keeps its top number, just with a placeholder label.
async function resolveDcrClientName(nextUrl: string): Promise<string> {
  const qsIndex = nextUrl.indexOf("?");
  if (qsIndex === -1) return "Asistent fără nume";
  const usp = new URLSearchParams(nextUrl.slice(qsIndex + 1));
  const clientId = usp.get("client_id");
  if (!clientId) return "Asistent fără nume";
  try {
    const rows = await db
      .select({ name: schema.oauthApplication.name })
      .from(schema.oauthApplication)
      .where(eq(schema.oauthApplication.clientId, clientId))
      .limit(1);
    return rows[0]?.name?.trim() || "Asistent fără nume";
  } catch {
    return "Asistent fără nume";
  }
}
