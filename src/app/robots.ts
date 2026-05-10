import type { MetadataRoute } from "next";

import { env } from "@/env";
import { listIndexedDocumentYears } from "@/lib/search";

// `/cauta` and `/cont/*` are intentionally NOT disallowed here — both pages
// already ship `noindex,follow` meta tags, and disallowing them in robots.txt
// would prevent crawlers from reading those tags (allowing the URLs to be
// indexed via inbound links alone). Disallow only true non-content surfaces.
//
// Sitemap discovery: Next.js 16's `generateSitemaps()` (see `sitemap.ts`)
// emits each shard at `/sitemap/<id>.xml` but does not auto-generate a
// `<sitemapindex>` document. Adding a custom handler at `/sitemap.xml`
// conflicts with the metadata loader's URL namespace, so we advertise each
// shard as its own `Sitemap:` line — fully supported by the sitemap protocol
// and treated by Google/Bing as equivalent to a single index pointing at all
// shards. The shard-id scheme is kept in lockstep with `sitemap.ts`.
const ORIGIN = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
const DOC_SHARD_PREFIX = "docs-";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const years = await listIndexedDocumentYears();
  const shardIds: string[] = [
    "static",
    "persons",
    "committees",
    ...years.map((year) => `${DOC_SHARD_PREFIX}${year}`),
  ];
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/mcp/server", "/cont/"],
      },
    ],
    sitemap: shardIds.map((id) => `${ORIGIN}/sitemap/${id}.xml`),
  };
}
