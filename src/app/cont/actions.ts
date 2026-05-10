"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

// Kick off the Google OAuth flow. Better Auth returns a `url` we must
// hard-redirect to (Google's authorize endpoint with the PKCE state +
// callbackURL embedded). Calling `redirect()` from a Server Action is the
// correct shape — Next.js converts it into a full-page navigation that
// breaks out of the form's response.
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const callbackURL =
    typeof formData.get("callbackURL") === "string"
      ? (formData.get("callbackURL") as string)
      : "/cont";
  const result = await auth.api.signInSocial({
    body: { provider: "google", callbackURL },
    headers: await headers(),
  });
  if (!result?.url) {
    throw new Error("signInSocial returned no redirect URL");
  }
  redirect(result.url);
}

// Sign out the current session and bounce home. `nextCookies()` (last in
// the auth plugin chain) handles the Set-Cookie -> cookies() bridging so
// the cleared session cookie reaches the browser.
export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

// Revoke every access token + consent record this user has issued to a
// given DCR-registered MCP client. Refresh tokens become unusable
// immediately; outstanding access tokens (cached client-side) keep working
// until they expire — Better Auth doesn't support synchronous token-list
// invalidation today, and the access TTL is short enough (~1d default)
// that this is acceptable per the auth handoff.
//
// `clientId` is the DCR-issued OAuth client ID (not the user's row ID),
// scoped to the authenticated user via the session check below.
export async function revokeClientAction(formData: FormData): Promise<void> {
  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) {
    throw new Error("revokeClientAction: clientId is required");
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/cont/intra");
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.oauthAccessToken)
      .where(
        and(
          eq(schema.oauthAccessToken.userId, session.user.id),
          eq(schema.oauthAccessToken.clientId, clientId),
        ),
      );
    await tx
      .delete(schema.oauthConsent)
      .where(
        and(
          eq(schema.oauthConsent.userId, session.user.id),
          eq(schema.oauthConsent.clientId, clientId),
        ),
      );
  });
  // Cache-busting redirect to force the page to re-fetch the (now empty)
  // tokens list. `redirect()` in Server Actions naturally invalidates the
  // current segment.
  redirect("/cont");
}

// Lookup helper: list distinct DCR clients the current user has authorized,
// joined with their `oauthApplication` row (display name + registration
// date). One row per (clientId, userId) pair, ordered by most recently
// issued token. Used by `/cont/page.tsx`.
export interface AuthorizedClient {
  clientId: string;
  name: string | null;
  metadata: string | null;
  firstAuthorizedAt: Date | null;
  lastAuthorizedAt: Date | null;
  tokenCount: number;
}

// `sql<Date | null>` is just a TS hint — it doesn't register a pg type
// parser, so min/max(timestamp) round-trips as a string (or whatever pg's
// default parser yields). Normalize to a real Date here so callers can
// `Intl.DateTimeFormat.format()` the result without runtime surprises.
function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function listAuthorizedClients(userId: string): Promise<AuthorizedClient[]> {
  const rows = await db
    .select({
      clientId: schema.oauthApplication.clientId,
      name: schema.oauthApplication.name,
      metadata: schema.oauthApplication.metadata,
      firstAuthorizedAt: sql<Date | string | null>`min(${schema.oauthAccessToken.createdAt})`,
      lastAuthorizedAt: sql<Date | string | null>`max(${schema.oauthAccessToken.createdAt})`,
      tokenCount: sql<number>`count(*)::int`,
    })
    .from(schema.oauthAccessToken)
    .innerJoin(
      schema.oauthApplication,
      eq(schema.oauthAccessToken.clientId, schema.oauthApplication.clientId),
    )
    .where(eq(schema.oauthAccessToken.userId, userId))
    .groupBy(
      schema.oauthApplication.clientId,
      schema.oauthApplication.name,
      schema.oauthApplication.metadata,
    )
    .orderBy(sql`max(${schema.oauthAccessToken.createdAt}) desc nulls last`);
  return rows.map((row) => ({
    clientId: row.clientId ?? "",
    name: row.name,
    metadata: row.metadata,
    firstAuthorizedAt: toDate(row.firstAuthorizedAt),
    lastAuthorizedAt: toDate(row.lastAuthorizedAt),
    tokenCount: row.tokenCount,
  }));
}
