import { oAuthProtectedResourceMetadata } from "better-auth/plugins";

import { auth } from "@/lib/auth";

// RFC 9728 "OAuth 2.0 Protected Resource Metadata" — the document a
// streamable-HTTP MCP client fetches to learn which authorization servers
// guard this resource. Publishes the issuer URL, JWKS endpoint, supported
// scopes, bearer methods, and signing algorithms.
//
// Required by the MCP spec for spec-blessed OAuth 2.0 discovery; clients
// that fail to parse `WWW-Authenticate` headers fall back to this URL.
// Must be reachable WITHOUT authentication — discovery happens before any
// token exists.
export const GET = oAuthProtectedResourceMetadata(auth);
