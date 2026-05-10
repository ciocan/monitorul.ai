import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsentViewedTracker } from "@/components/analytics/page-trackers";
import { McpOauthCompletedForm } from "@/components/analytics/tracked-submit";
import { Dateline } from "@/components/dateline";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

import { acceptConsentAction, denyConsentAction } from "./actions";

// Themed OAuth consent screen. The MCP plugin's authorization endpoint
// hands off to this page (per `oidcConfig.consentPage` in `src/lib/auth.ts`)
// with three query params:
//
//   - `consent_code` — opaque short-lived id; we hand back to /oauth2/consent
//   - `client_id`    — the DCR-registered app asking for access
//   - `scope`        — space-separated list of scopes (we surface them)
//
// The visual job here is anti-phishing: a confused user about to authorise a
// shady "monitorul-helper" needs to see the client's registered name + the
// redirect URL it's going back to, in our own visual register, in plain
// Romanian. The `Acceptă` button posts the consent code; `Refuză` cancels.
export const metadata: Metadata = {
  title: "Permite accesul — monitorul.ai",
  description: "Confirmă accesul unui asistent AI la contul tău pe monitorul.ai.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cont/consimt" },
};

interface PageProps {
  searchParams: Promise<{
    consent_code?: string;
    client_id?: string;
    scope?: string;
  }>;
}

interface ScopeRow {
  id: string;
  label: string;
  detail: string;
}

// Default-scope copy. Single `mcp` scope per the auth handoff (per-tool
// scope partitioning is deferred). Anything else surfaces as an unknown
// row so the user still has a chance to refuse.
const SCOPE_COPY: Record<string, ScopeRow> = {
  openid: {
    id: "openid",
    label: "Identitate de bază",
    detail: "Acces la ID-ul de cont (ID intern, nu adresa de e-mail).",
  },
  profile: {
    id: "profile",
    label: "Profil",
    detail: "Acces la numele afișat din contul Google.",
  },
  email: {
    id: "email",
    label: "Adresă de e-mail",
    detail: "Acces la adresa de e-mail asociată contului tău.",
  },
  offline_access: {
    id: "offline_access",
    label: "Reîmprospătare automată",
    detail:
      "Permite asistentului să își reîmprospăteze cheia după ce expiră, fără să te mai autentifici (până la revocare din /cont).",
  },
};

function describeScopes(scope: string | undefined): ScopeRow[] {
  if (!scope) return [];
  return scope
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (s) =>
        SCOPE_COPY[s] ?? {
          id: s,
          label: `Permisiune nestandardă: ${s}`,
          detail:
            "Această permisiune nu este parte din setul implicit. Refuză dacă nu o recunoști.",
        },
    );
}

export default async function ContConsimtPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  const params = await searchParams;
  const consentCode = params.consent_code;
  const clientId = params.client_id;
  const scope = params.scope;

  // Bounce to sign-in if not signed in; the consent flow will pick up the
  // same query params on the way back via the OIDC plugin's state cookie.
  if (!session) {
    const next = `/cont/consimt?${new URLSearchParams({
      ...(consentCode ? { consent_code: consentCode } : {}),
      ...(clientId ? { client_id: clientId } : {}),
      ...(scope ? { scope } : {}),
    }).toString()}`;
    redirect(`/cont/intra?next=${encodeURIComponent(next)}`);
  }

  // The OIDC plugin throws errors back to the original redirect URI when
  // params are missing — but if a user lands here directly, surface a
  // plain message rather than an internal-error page.
  if (!consentCode || !clientId) {
    return (
      <article className="mx-auto w-full max-w-prose px-6 py-12 sm:py-16">
        <Dateline parts={["Cont", "Consimțământ", "Monitorul.ai"]} />
        <h1 className="mt-6 font-display text-4xl text-ink-16">Cerere incompletă</h1>
        <p className="mt-6 text-base leading-relaxed text-ink-30">
          Această pagină se deschide automat în timpul conectării unui asistent AI. Dacă ai ajuns
          aici dintr-un link, întoarce-te la{" "}
          <Link href="/cont" className="underline underline-offset-4 hover:text-ink-16">
            /cont
          </Link>
          .
        </p>
      </article>
    );
  }

  const application = await db
    .select({
      name: schema.oauthApplication.name,
      icon: schema.oauthApplication.icon,
      metadata: schema.oauthApplication.metadata,
      redirectUrls: schema.oauthApplication.redirectUrls,
    })
    .from(schema.oauthApplication)
    .where(eq(schema.oauthApplication.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const scopes = describeScopes(scope);
  const redirectUrls = parseRedirectUrls(application?.redirectUrls);
  const clientName = application?.name?.trim() || "Asistent fără nume";

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-8 sm:py-10">
      <ConsentViewedTracker client_name={clientName} />
      <Dateline parts={["Cont", "Consimțământ", "Monitorul.ai"]} />
      <header className="mt-5 border-b border-border pb-5">
        <h1 className="font-display text-3xl leading-[1.05] text-ink-16 sm:text-4xl">
          Permite accesul?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-30">
          Un asistent AI cere acces la contul tău <code>monitorul.ai</code>. Verifică numele și
          URL-ul de mai jos înainte să accepți. Poți revoca în orice moment din pagina ta de cont.
        </p>
      </header>

      <section className="mt-5 border border-border bg-paper-96 p-4">
        <h2 className="label-mono text-ink-30">Aplicație</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-6">
          <dt className="label-mono text-ink-45">Nume</dt>
          <dd className="font-sans text-base font-semibold text-ink-16">{clientName}</dd>
          <dt className="label-mono text-ink-45">ID</dt>
          <dd className="font-mono text-xs break-all text-ink-30">{clientId}</dd>
          {redirectUrls.length > 0 ? (
            <>
              <dt className="label-mono text-ink-45">Redirect</dt>
              <dd className="space-y-1 font-mono text-xs text-ink-30">
                {redirectUrls.map((url) => (
                  <div key={url} className="break-all">
                    {url}
                  </div>
                ))}
              </dd>
            </>
          ) : null}
          <dt className="label-mono text-ink-45">Acordat de</dt>
          <dd className="font-mono text-xs text-ink-30">{session.user.email}</dd>
        </dl>
      </section>

      <section className="mt-5">
        <h2 className="label-mono text-ink-30">Permisiuni cerute · {scopes.length}</h2>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {scopes.map((s) => (
            <li key={s.id} className="grid gap-0.5 py-2.5">
              <p className="font-sans text-sm font-semibold text-ink-16">{s.label}</p>
              <p className="font-mono text-xs text-ink-45">{s.id}</p>
              <p className="text-xs leading-relaxed text-ink-30">{s.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <McpOauthCompletedForm action={acceptConsentAction} clientName={clientName}>
            <input type="hidden" name="consent_code" value={consentCode} />
            <Button type="submit" size="lg" variant="default">
              Acceptă și conectează
            </Button>
          </McpOauthCompletedForm>
          <form action={denyConsentAction}>
            <input type="hidden" name="consent_code" value={consentCode} />
            <Button type="submit" size="lg" variant="outline">
              Refuză
            </Button>
          </form>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-45">
          Dacă numele aplicației sau URL-ul de redirect ți se par străine sau înșelătoare, nu
          accepta. Asistenții AI legitimi se identifică sub numele lor publice (<em>Claude</em>,{" "}
          <em>Cursor</em>, <em>Cline</em>, <em>Codex</em>). În caz de dubiu, refuză și pornește din
          nou conectarea direct din asistent.
        </p>
      </section>
    </article>
  );
}

function parseRedirectUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  // The DCR registration may store redirect URIs as either a JSON array
  // (per the canonical schema) or a comma-separated string (per older
  // adapter behaviour). Try both, fall back to the raw value.
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // not JSON — fall through
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
