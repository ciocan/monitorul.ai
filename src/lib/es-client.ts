import "server-only";

import { Client } from "@elastic/elasticsearch";

const ES_URL = process.env.ES_URL ?? "";
const ES_API_KEY = process.env.ES_API_KEY ?? "";
// Self-hosted ES (monitorul-ii's box) ships a self-signed cert; certificate
// verification is off by default and turned on only when `ES_VERIFY_CERTS=1`
// is set explicitly (e.g. against a managed ES with a public chain).
const ES_VERIFY_CERTS = process.env.ES_VERIFY_CERTS === "1";

if (!ES_URL || !ES_API_KEY) {
  console.warn(
    "[es-client] ES_URL or ES_API_KEY not set; queries will fail. Set both in .env.local.",
  );
}

let cached: Client | null = null;

export function esClient(): Client {
  if (cached) return cached;
  cached = new Client({
    node: ES_URL,
    auth: { apiKey: ES_API_KEY },
    tls: ES_VERIFY_CERTS ? undefined : { rejectUnauthorized: false },
    requestTimeout: 10_000,
    maxRetries: 1,
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

export const QUERY_LOG_INDEX = "monitorul_query_log";
