# Auth + DB setup

Operational guide for provisioning the auth + database side of monitorul.ai.
Read this when standing up a new environment (prod, preview, fresh local) or
debugging a redirect / cookie / connection error.

Design background — what the auth surface is, how the OAuth dance works, where
the per-user attribution flows — lives in [`mcp.md`](./mcp.md) (Auth section) and
[`architecture.md`](./architecture.md). This file is the click-by-click recipe.

The full env-var contract is enforced by [`src/env.ts`](../src/env.ts); if you
add or rename one, edit the schema there too.

## What you provision

| Resource              | Purpose                                            | Per-env?                                              |
| --------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Neon Postgres project | User / session / OAuth tables                      | One project, one branch per env                       |
| Better Auth secret    | HS256 signing key for sessions + JWT bearer tokens | One per env (rotation invalidates all refresh tokens) |
| Google OAuth client   | The "Sign in with Google" surface                  | Two clients (prod + dev/preview)                      |
| Vercel env vars       | Surface all of the above to the runtime            | Three scopes (Production / Preview / Development)     |

## 1. Neon Postgres

1. Create a project named `monitorul-ai`. Region: pick one geographically close
   to your Vercel region.
2. Branches: rename the default to `main` (production); create `dev`.
3. For each branch, copy two URLs from the Neon dashboard:
   - **Pooler URL** — the one with `-pooler` in the hostname (e.g.
     `ep-xxx-pooler.eu-central-1.aws.neon.tech`). Used by the runtime.
   - **Direct URL** — the same hostname without `-pooler`. Used by `drizzle-kit`
     for migrations.
4. Add `?sslmode=require` to both. (`?sslmode=verify-full` silences a `pg`
   deprecation warning but requires a publicly chained CA — Neon's default
   chain is fine for `verify-full`, so use it if you want quiet logs.)

Map them to env vars:

- `DATABASE_URL` ← pooler URL of the branch this environment uses
- `DATABASE_DIRECT_URL` ← direct URL of the same branch

Production uses the `main` branch; preview + local development use `dev`.

## 2. Better Auth secret

```sh
openssl rand -hex 32
```

Use a different secret per environment if you want isolation; otherwise one
shared secret across all envs is acceptable. Rotation invalidates every
outstanding refresh token (users re-auth on next call) — schedule it during
low traffic, e.g. yearly.

`BETTER_AUTH_SECRET` ← the hex string.

## 3. Google Cloud Console

### 3a. OAuth consent screen (one-time, project-wide)

`APIs & Services → OAuth consent screen`:

| Field                        | Value                                                                 |
| ---------------------------- | --------------------------------------------------------------------- |
| User type                    | External                                                              |
| App name                     | `monitorul.ai`                                                        |
| User support email           | the maintainer's address                                              |
| App logo                     | optional but worth uploading (anti-phishing cue)                      |
| Application home page        | `https://monitorul.ai`                                                |
| Application privacy policy   | `https://monitorul.ai/despre#confidentialitate`                       |
| Application terms of service | `https://monitorul.ai/despre#confidentialitate`                       |
| Authorized domains           | `monitorul.ai`                                                        |
| Scopes                       | `openid`, `.../userinfo.email`, `.../userinfo.profile` — nothing else |
| Test users                   | every Google account that will sign in while in Testing               |
| Publishing status            | leave **Testing** until you're ready for public traffic               |

Better Auth never asks for restricted or sensitive scopes, so Google
verification is not required to publish. Once the app moves out of Testing,
non-test Google accounts can sign in.

### 3b. Two OAuth client IDs

`APIs & Services → Credentials → Create credentials → OAuth client ID`.
Application type: **Web application** for both.

#### Client A — `monitorul-ai · prod`

| Field                         | Value                                           |
| ----------------------------- | ----------------------------------------------- |
| Authorized JavaScript origins | `https://monitorul.ai`                          |
| Authorized redirect URIs      | `https://monitorul.ai/api/auth/callback/google` |

#### Client B — `monitorul-ai · dev + preview`

| Field                         | Value                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| Authorized JavaScript origins | `http://localhost:3020`                                                  |
|                               | `https://<your-stable-preview-host>.vercel.app`                          |
| Authorized redirect URIs      | `http://localhost:3020/api/auth/callback/google`                         |
|                               | `https://<your-stable-preview-host>.vercel.app/api/auth/callback/google` |

The "stable preview host" is the alias Vercel assigns to the `dev` branch —
look for `git-dev` in `Vercel → Project → Settings → Domains`. Google does NOT
support wildcard redirect URIs, so per-deploy preview URLs (the long
`<branch>-<sha>.vercel.app` ones) won't work; tie auth to the branch alias and
test from there.

For each client, copy the **Client ID** + **Client secret** to feed into
Vercel + `.env.local` below.

## 4. Vercel env vars

Set per scope. The CLI form (preferred — pass the same values once and tag
which envs):

```sh
vercel env add DATABASE_URL              # paste the main-branch pooler URL    → Production
vercel env add DATABASE_URL              # paste the dev-branch pooler URL     → Preview, Development
vercel env add DATABASE_DIRECT_URL       # paste the main-branch direct URL    → Production
vercel env add DATABASE_DIRECT_URL       # paste the dev-branch direct URL     → Preview, Development
vercel env add BETTER_AUTH_SECRET        # paste the hex                       → Production, Preview, Development
vercel env add BETTER_AUTH_URL           # https://monitorul.ai                → Production
vercel env add BETTER_AUTH_URL           # https://<preview-alias>.vercel.app  → Preview
vercel env add BETTER_AUTH_URL           # http://localhost:3020               → Development
vercel env add GOOGLE_CLIENT_ID          # Client A id                         → Production
vercel env add GOOGLE_CLIENT_ID          # Client B id                         → Preview, Development
vercel env add GOOGLE_CLIENT_SECRET      # Client A secret                     → Production
vercel env add GOOGLE_CLIENT_SECRET      # Client B secret                     → Preview, Development
```

The Production / Preview / Development scopes correspond to: `main` deploys,
preview deploys (any branch), and `vercel dev` / `vercel env pull` consumers.
The "Development" scope is what populates `.env.local` when you run
`vercel env pull` — handy if you don't want to maintain `.env.local` by hand.

## 5. Local development

If you don't use `vercel env pull`, hand-write `.env.local`:

```sh
# Neon dev branch
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require
DATABASE_DIRECT_URL=postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DB?sslmode=require

# Better Auth
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:3020

# Google client B (dev + preview)
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

Plus the existing ES / R2 / Upstash vars per [`.env.example`](../.env.example).

## 6. First migration on a fresh DB

After populating env vars, generate the schema and apply migrations:

```sh
# Generates src/lib/db/schema.ts from src/lib/auth.ts. Re-run if you add or
# change Better Auth plugins.
node_modules/.bin/better-auth generate --output src/lib/db/schema.ts -y

# Generates SQL in src/lib/db/migrations/.
bun --env-file=.env.local --bun drizzle-kit generate

# Applies pending migrations against DATABASE_DIRECT_URL.
bun --env-file=.env.local --bun drizzle-kit migrate
```

`drizzle-kit migrate` is idempotent — re-running it on a DB that's up to date
is a no-op. The auto-generated schema must be committed (`src/lib/db/schema.ts`

- `src/lib/db/migrations/*.sql`).

## 7. Verifying

```sh
bun run dev
```

Then, in another terminal:

```sh
# Discovery routes (public)
curl -s http://localhost:3020/.well-known/oauth-authorization-server | jq .issuer
# → "http://localhost:3020"  (must match BETTER_AUTH_URL)

curl -s http://localhost:3020/.well-known/oauth-protected-resource | jq .resource
# → "http://localhost:3020"

# MCP route is auth-gated
curl -sI -X POST http://localhost:3020/mcp/server \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -i 'www-authenticate'
# → www-authenticate: Bearer resource_metadata="http://localhost:3020/api/auth/.well-known/oauth-protected-resource"

# DCR works (registers a fake client)
curl -s -X POST http://localhost:3020/api/auth/mcp/register \
  -H 'content-type: application/json' \
  -d '{"client_name":"Smoke","redirect_uris":["http://localhost:9999/callback"]}' | jq .client_id
# → "<random 32-char id>"
```

For the Google sign-in itself, open `http://localhost:3020/cont/intra` in a
browser and click **Conectare cu Google**. After consent you should land on
`/cont` with your email shown.

## Common pitfalls

- **`redirect_uri_mismatch`** from Google. The redirect URI you configured in
  the Google Console must byte-for-byte equal `BETTER_AUTH_URL` +
  `/api/auth/callback/google`. Trailing slashes count; `http://` vs `https://`
  counts; `localhost` vs `127.0.0.1` counts. Fix the Console entry, not the code.
- **`invalid_client` from `/api/auth/mcp/token`** during the OAuth dance.
  Means `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` don't match the redirect
  URI's client. You probably mixed prod + dev clients across env scopes.
- **Cookie not set after sign-in.** `BETTER_AUTH_URL` must equal the actual
  scheme + host the browser is talking to. If you serve dev on `0.0.0.0:3020`
  but `BETTER_AUTH_URL=http://localhost:3020`, the cookie domain mismatch
  silently drops the session cookie.
- **Per-deploy Vercel preview URLs don't work** for Google sign-in. Google
  requires every redirect URI to be pre-registered; per-commit URLs change
  every push. Use the stable `git-<branch>` alias instead and test against
  that.
- **Neon SSL warning** in `pg` logs:
  `SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'`.
  Cosmetic today, breaking in `pg` v9. Switch the connection string to
  `?sslmode=verify-full` (Neon's default chain works) or
  `?uselibpqcompat=true&sslmode=require` to opt in to the new behaviour now.
- **Verification banner on Google's sign-in screen** while the consent screen
  is in Testing. Only test users you listed can sign in; everyone else gets
  "Access blocked: monitorul.ai has not completed the Google verification
  process." Move the consent screen out of Testing once production is live.
- **Better Auth's own rate limiter** (separate from the MCP one) protects
  `/api/auth/*`. Defaults are fine for production; if a developer is testing
  the same path repeatedly and getting throttled, tune via the `rateLimit`
  config in [`src/lib/auth.ts`](../src/lib/auth.ts) or use Better Auth's
  storage backend so the limiter is shared across function instances.
- **Rotating `BETTER_AUTH_SECRET` invalidates all refresh tokens.** Users get
  re-prompted to sign in on next MCP call; their connected clients (Claude
  Desktop, etc.) handle this automatically via `mcp-remote`. Schedule rotation
  during low-traffic windows.
