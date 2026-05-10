import { initBotId } from "botid/client/core";

// Browser-initiated POSTs in the auth + OAuth-consent flow. See
// docs/_session-handoff-2026-05-10-botid.md for the full threat model.
//
// Server actions submit a POST to the URL the form was rendered on
// (NOT to the action file path), so we list page URLs.
//
// Do NOT add /api/auth/* (server-to-server / GET callback only) or
// /mcp/server (bearer-token server-to-server) here.
initBotId({
  protect: [
    { path: "/cont/intra", method: "POST" },
    { path: "/cont", method: "POST" },
    { path: "/cont/consimt", method: "POST" },
  ],
});
