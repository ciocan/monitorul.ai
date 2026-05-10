import { oAuthDiscoveryMetadata } from "better-auth/plugins";

import { auth } from "@/lib/auth";

// RFC 8414 "OAuth 2.0 Authorization Server Metadata" — what the MCP
// client reads next, after `/.well-known/oauth-protected-resource` points
// it at this issuer. Publishes the authorization / token / registration /
// jwks / userinfo endpoints, supported grant types, response types, code
// challenge methods, etc.
//
// Public, like its sibling. The whole MCP OAuth dance starts with two
// unauthenticated GETs to this and the protected-resource doc.
export const GET = oAuthDiscoveryMetadata(auth);
