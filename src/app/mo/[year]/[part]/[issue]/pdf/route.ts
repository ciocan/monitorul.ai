import { getDocument } from "@/lib/search";
import { isPdfBucketConfigured, pdfKeyForDocument, presignPdfUrl } from "@/lib/pdf";

// Each request gets a freshly-signed URL. Caching the redirect would cache
// the (expiring) signature too, which is the wrong trade — signing is
// microseconds, the signed URL TTL is 5 minutes, and we want every page
// reload to start from a fresh window.
export const dynamic = "force-dynamic";

interface RouteParams {
  year: string;
  part: string;
  issue: string;
}

function recordIdFromParams(p: RouteParams): string {
  return `mo://${p.year}/${p.part}/${p.issue}`;
}

export async function GET(_req: Request, { params }: { params: Promise<RouteParams> }) {
  const p = await params;
  if (!isPdfBucketConfigured()) {
    return new Response("PDF storage not configured", { status: 503 });
  }
  const doc = await getDocument(recordIdFromParams(p));
  if (!doc) {
    return new Response("Document not found", { status: 404 });
  }
  const key = pdfKeyForDocument(doc);
  if (!key) {
    return new Response("PDF unavailable for this document", { status: 404 });
  }
  const signedUrl = await presignPdfUrl(key);
  return Response.redirect(signedUrl, 302);
}
