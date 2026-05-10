import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountViewedTracker } from "@/components/analytics/page-trackers";
import { Dateline } from "@/components/dateline";
import { Button } from "@/components/ui/button";
import type { AccountViewedProps } from "@/lib/analytics";
import { auth } from "@/lib/auth";

import { listAuthorizedClients, revokeClientAction, signOutAction } from "./actions";

// Account page. Shown to a signed-in user; bounces to /cont/intra otherwise.
// Lists every DCR-registered MCP client this user has authorized, with a
// per-client revoke. Also shows email + a global sign-out.
//
// `noindex` because the page is per-user. The public-facing description of
// what the MCP server does is at /mcp; the methodology lives at /despre.
export const metadata: Metadata = {
  title: "Cont — monitorul.ai",
  description:
    "Asistenții AI conectați la contul tău pe monitorul.ai și controlul lor (revocare, deconectare).",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cont" },
};

// Same locale used elsewhere on the site for date display.
const DATE_FMT = new Intl.DateTimeFormat("ro-RO", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

// DCR clients can ship a JSON `metadata` blob during /mcp/register. Cheap
// safe parse to surface a redirect URL or a software_id when available;
// failures fall back silently to the registered name.
function parseClientMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function authorizedClientBucket(
  count: number,
): AccountViewedProps["authorized_client_count_bucket"] {
  if (count === 0) return "0";
  if (count === 1) return "1";
  if (count <= 5) return "2-5";
  return "6+";
}

export default async function ContPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/cont/intra");

  const clients = await listAuthorizedClients(session.user.id);

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-12 sm:py-16">
      <AccountViewedTracker
        authorized_client_count_bucket={authorizedClientBucket(clients.length)}
      />
      <Dateline parts={["Cont", session.user.email, "Monitorul.ai"]} />
      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-[1.05] text-ink-16 sm:text-5xl">Cont</h1>
        <p className="mt-6 text-base leading-relaxed text-ink-30">
          Aici vezi asistenții AI care au acces la serverul MCP <code>monitorul.ai</code> prin
          contul tău și poți revoca oricare dintre ei. Revocarea face inutilă cheia de
          reîmprospătare imediat; cheia de acces curentă (~24 ore) expiră în mod natural.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="label-mono text-ink-30">Asistenți AI conectați · {clients.length}</h2>
        {clients.length === 0 ? (
          <div className="mt-4 border border-border bg-paper-96 p-6">
            <p className="text-sm leading-relaxed text-ink-30">
              Nu ai încă niciun asistent conectat. Configurează unul (Claude Desktop, Cursor, Codex,
              Cline) urmând instrucțiunile de pe pagina{" "}
              <Link href="/mcp" className="underline underline-offset-4 hover:text-ink-16">
                /mcp
              </Link>{" "}
              — la prima cerere către server, asistentul va deschide un browser și se va înregistra
              automat sub contul tău.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {clients.map((c) => {
              const meta = parseClientMetadata(c.metadata);
              const softwareId = typeof meta?.software_id === "string" ? meta.software_id : null;
              const clientUri = typeof meta?.client_uri === "string" ? meta.client_uri : null;
              return (
                <li
                  key={c.clientId}
                  className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="space-y-1.5">
                    <p className="font-sans text-base font-semibold text-ink-16">
                      {c.name ?? "Asistent fără nume"}
                    </p>
                    <p className="font-mono text-xs text-ink-45">{c.clientId}</p>
                    <p className="text-xs text-ink-45">
                      Prima conectare:{" "}
                      <span className="text-ink-30">{formatDate(c.firstAuthorizedAt)}</span>
                      <span className="px-2">·</span>
                      Ultima reîmprospătare:{" "}
                      <span className="text-ink-30">{formatDate(c.lastAuthorizedAt)}</span>
                      <span className="px-2">·</span>
                      <span className="text-ink-30">
                        {c.tokenCount} {c.tokenCount === 1 ? "cheie" : "chei"}
                      </span>
                    </p>
                    {softwareId || clientUri ? (
                      <p className="font-mono text-xs text-ink-45">
                        {softwareId ? <span>software: {softwareId}</span> : null}
                        {softwareId && clientUri ? <span className="px-2">·</span> : null}
                        {clientUri ? (
                          <a
                            href={clientUri}
                            rel="noreferrer"
                            target="_blank"
                            className="underline underline-offset-4 hover:text-ink-16"
                          >
                            {clientUri}
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <form
                    action={revokeClientAction}
                    className="justify-self-start sm:justify-self-end"
                  >
                    <input type="hidden" name="clientId" value={c.clientId} />
                    <Button type="submit" variant="outline" size="sm">
                      Revocă
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="label-mono text-ink-30">Sesiune</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-[max-content_1fr] sm:gap-x-6">
          <dt className="label-mono text-ink-45">E-mail</dt>
          <dd className="font-mono text-sm text-ink-16">{session.user.email}</dd>
          <dt className="label-mono text-ink-45">Nume</dt>
          <dd className="font-sans text-sm text-ink-16">{session.user.name}</dd>
        </dl>
        <form action={signOutAction} className="mt-6">
          <Button type="submit" variant="outline" size="default">
            Deconectează-te
          </Button>
        </form>
      </section>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="label-mono text-ink-30">Confidențialitate</h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-30">
          Stocăm e-mailul, ID-ul Google, și o atribuire pe ID intern a fiecărei cereri spre serverul
          MCP, pentru limitare de rată și diagnoză a abuzului. Detaliile complete și procedura de
          ștergere sunt în nota metodologică:{" "}
          <Link
            href="/despre#identitate"
            className="underline underline-offset-4 hover:text-ink-16"
          >
            /despre#identitate
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
