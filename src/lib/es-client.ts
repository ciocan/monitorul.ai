import "server-only";

import { Client } from "@elastic/elasticsearch";

import { env } from "@/env";

let cached: Client | null = null;

export function esClient(): Client {
  if (cached) return cached;
  cached = new Client({
    // `nodes` (plural) round-robins across the cluster by default. Dead nodes
    // are taken out of rotation on connection failure with exponential backoff
    // (~60s before re-probe). Sniffing is intentionally disabled — published
    // node addresses aren't reachable from Vercel functions on most self-
    // hosted topologies.
    nodes: env.ES_URL,
    auth: { apiKey: env.ES_API_KEY },
    tls: env.ES_VERIFY_CERTS ? undefined : { rejectUnauthorized: false },
    requestTimeout: 10_000,
    // Retries land on the next node in the pool, so a single bad node never
    // fails a request as long as the cluster has healthy peers.
    maxRetries: 3,
  });
  return cached;
}

export const ES_INDEX = {
  documents: "mo-documents",
  agendaItems: "mo-agenda-items",
  speeches: "mo-speeches",
  votes: "mo-votes",
  interpellations: "mo-interpellations",
  questions: "mo-questions",
  committeeMeetings: "mo-committee-meetings",
  reports: "mo-reports",
  persons: "mo-persons",
} as const;

export const QUERY_LOG_INDEX = "mo_query_log";
