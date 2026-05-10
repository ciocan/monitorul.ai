"use server";

import { checkBotId } from "botid/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// The OIDC `/oauth2/consent` endpoint expects a body of `{ accept, consent_code }`
// and returns `{ redirectURI }` — the URI that bounces the user (and the
// authorization code) back to the asking client. Both the accept and deny
// paths follow the same shape; only `accept` differs.
//
// Server-component pages can't call POST endpoints directly, but Better
// Auth exposes the same handlers via `auth.api.oAuthConsent`. Calling
// through there inherits the authenticated session from request headers
// and writes any new cookies via `nextCookies()`.

export async function acceptConsentAction(formData: FormData): Promise<void> {
  const verification = await checkBotId();
  if (verification.isBot) {
    throw new Error("Access denied");
  }
  const consentCode = formData.get("consent_code");
  if (typeof consentCode !== "string" || !consentCode) {
    throw new Error("acceptConsentAction: consent_code is required");
  }
  const result = await auth.api.oAuthConsent({
    body: { accept: true, consent_code: consentCode },
    headers: await headers(),
  });
  if (!result?.redirectURI) {
    throw new Error("oAuthConsent returned no redirectURI");
  }
  redirect(result.redirectURI);
}

export async function denyConsentAction(formData: FormData): Promise<void> {
  const verification = await checkBotId();
  if (verification.isBot) {
    throw new Error("Access denied");
  }
  const consentCode = formData.get("consent_code");
  if (typeof consentCode !== "string" || !consentCode) {
    throw new Error("denyConsentAction: consent_code is required");
  }
  const result = await auth.api.oAuthConsent({
    body: { accept: false, consent_code: consentCode },
    headers: await headers(),
  });
  if (!result?.redirectURI) {
    // Deny path may return an error redirect from the OIDC layer; bounce
    // home if Better Auth couldn't resolve a target.
    redirect("/cont");
  }
  redirect(result.redirectURI);
}
