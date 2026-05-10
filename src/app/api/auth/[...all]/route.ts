import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth's catch-all. Handles every endpoint the auth instance
// registers — Google sign-in callback, session lookup, sign-out, the OIDC
// /oauth2/* endpoints, the MCP /mcp/{authorize,token,register,consent}
// endpoints — under a single Next.js dynamic route.
//
// Public; never gated. The MCP wrapper protects only `/mcp/server` —
// everything under `/api/auth/*` must stay reachable without a bearer
// token, otherwise sign-in itself becomes impossible.
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(auth);
