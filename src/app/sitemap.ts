import type { MetadataRoute } from "next";

import { env } from "@/env";
import {
  listAllCommitteeIdsForSitemap,
  listAllPersonSlugsForSitemap,
  listDocumentUrlsForSitemap,
  listIndexedDocumentYears,
} from "@/lib/search";

// See `docs/_session-handoff-2026-05-10-sitemap.md` for the lean-vs-full
// scope decision. This module advertises static pages + politicians +
// committees + every document. Speeches (`/discurs/[slug]`) are deliberately
// omitted — they're discoverable through the dense internal-link graph.

export const revalidate = 3600;

const ORIGIN = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

// Shard ids are descriptive strings (Next.js 16 made `id` a `Promise<string>`,
// so the year-encoded numeric scheme described in the handoff has no benefit
// over readable ids). Document shards use the `docs-YYYY` prefix so the URL
// `/sitemap/docs-2026.xml` is self-explanatory and bookmark-stable.
const DOC_SHARD_PREFIX = "docs-";

// Static surfaces — keep in lockstep with the route inventory in CLAUDE.md.
// Routes deliberately excluded: `/cauta` + `/cont/*` (noindex; let crawlers
// see the meta tag), `/mcp/server` + `/api/*` (server endpoints),
// `/.well-known/*` (RFC discovery), `/mo/[year]/[part]/[issue]/pdf` (302).
const STATIC_PATHS: ReadonlyArray<string> = [
  "/",
  "/mo",
  "/politicieni",
  "/comisii",
  "/despre",
  "/despre/discurs",
  "/statistici",
  "/mcp",
  "/sustine",
  "/confidentialitate",
  "/termeni",
];

export async function generateSitemaps(): Promise<{ id: string }[]> {
  const years = await listIndexedDocumentYears();
  return [
    { id: "static" },
    { id: "persons" },
    { id: "committees" },
    ...years.map((year) => ({ id: `${DOC_SHARD_PREFIX}${year}` })),
  ];
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const shardId = await id;
  if (shardId === "static") return staticShard();
  if (shardId === "persons") return personShard();
  if (shardId === "committees") return committeeShard();
  if (shardId.startsWith(DOC_SHARD_PREFIX)) {
    const year = Number.parseInt(shardId.slice(DOC_SHARD_PREFIX.length), 10);
    if (Number.isInteger(year)) return documentShard(year);
  }
  return [];
}

function abs(path: string): string {
  return `${ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function toLastModified(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function staticShard(): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path) => ({ url: abs(path) }));
}

async function personShard(): Promise<MetadataRoute.Sitemap> {
  const persons = await listAllPersonSlugsForSitemap();
  return persons.map((p) => ({
    url: abs(p.urlPath),
    lastModified: toLastModified(p.lastModified),
  }));
}

async function committeeShard(): Promise<MetadataRoute.Sitemap> {
  const committees = await listAllCommitteeIdsForSitemap();
  return committees.map((c) => ({
    url: abs(`/comisii/${c.committeeId}`),
    lastModified: toLastModified(c.lastModified),
  }));
}

async function documentShard(year: number): Promise<MetadataRoute.Sitemap> {
  const docs = await listDocumentUrlsForSitemap({ year });
  return docs.map((d) => ({
    url: abs(d.urlPath),
    lastModified: toLastModified(d.lastModified),
  }));
}
