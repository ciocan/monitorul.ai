import "server-only";

import { Client } from "@elastic/elasticsearch";

import { env } from "@/env";

let cached: Client | null = null;

export function esClient(): Client {
  if (cached) return cached;
  cached = new Client({
    node: env.ES_URL,
    auth: { apiKey: env.ES_API_KEY },
    tls: env.ES_VERIFY_CERTS ? undefined : { rejectUnauthorized: false },
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
