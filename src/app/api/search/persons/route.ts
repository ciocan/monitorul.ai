import type { NextRequest } from "next/server";

import { requestContext } from "@/lib/request-context";
import { searchPersons } from "@/lib/search";

// Speaker autocomplete on /cauta. Wraps `searchPersons()` (which already does
// `multi_match` over canonical_name + .folded + aliases with operator: and).
//
// Cache for 5 min at the edge — the persons index changes weekly at most and
// this surface is read-heavy on a small typed-prefix space. `stale-while-
// revalidate` keeps the keystroke loop snappy after the TTL flips.

export const runtime = "nodejs";

const CACHE_HEADER = "public, s-maxage=300, max-age=60, stale-while-revalidate=86400";
const MAX_LIMIT = 10;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return Response.json({ hits: [] }, { headers: { "Cache-Control": CACHE_HEADER } });
  }
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : MAX_LIMIT;
  // Stamp `surface: "api"` so query-log analytics can split combobox traffic
  // from the web pages (`web`) and the MCP (`mcp`).
  const persons = await requestContext.run({ surface: "api" }, () =>
    searchPersons(q, { pageSize: limit, prefix: true }),
  );
  // Trim the payload — the combobox only renders name + slug.
  const hits = persons.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.canonical_name,
    homonym: p.homonym_disambiguation,
  }));
  return Response.json({ hits }, { headers: { "Cache-Control": CACHE_HEADER } });
}
