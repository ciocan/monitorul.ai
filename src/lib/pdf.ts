import "server-only";

import { AwsClient } from "aws4fetch";

import { env } from "@/env";
import type { MoDocument } from "./types";

// Bucket-key shape for the original PDFs is set upstream by the monitorul-ii
// scraper (see scraper.py `Issue.filename`):
//   `{published_iso}_MO-P{part}-{issue}-{year}.pdf`
// e.g. `2026-02-13_MO-PII-9c-2026.pdf`. We derive the key here rather than
// trusting the indexed `s3_url_pdf` field, which the upstream indexer leaves
// `null` today. Re-deriving on every request is free and survives the field
// being populated later (the two will agree).
export function pdfKeyForDocument(
  doc: Pick<MoDocument, "published" | "part" | "issue" | "year">,
): string | null {
  const date = doc.published;
  if (!date) return null;
  return `${date}_MO-P${doc.part}-${doc.issue}-${doc.year}.pdf`;
}

// Single shared signer. Returns null when the bucket isn't configured —
// callers should treat that as "no PDF available" and hide the link.
function awsClient(): AwsClient | null {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    return null;
  }
  return new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: "s3",
    region: env.S3_REGION,
  });
}

export interface PresignedUrlOptions {
  // Seconds until the signed URL expires. Default 5 min — long enough for the
  // browser to follow the 302 and start the download, short enough that a
  // leaked signature is useless. Cap at 7 days (the SigV4 hard limit).
  ttlSeconds?: number;
}

export function isPdfBucketConfigured(): boolean {
  return Boolean(
    env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET,
  );
}

// Mints a SigV4-presigned GET URL for `key`. Throws when the bucket isn't
// configured — callers should gate with `isPdfBucketConfigured()` first
// (the route handler does, before attempting to sign).
export async function presignPdfUrl(key: string, opts: PresignedUrlOptions = {}): Promise<string> {
  const aws = awsClient();
  if (!aws || !env.S3_ENDPOINT || !env.S3_BUCKET) {
    throw new Error("S3 bucket not configured");
  }
  const ttl = Math.min(opts.ttlSeconds ?? 300, 7 * 24 * 3600);
  const url = new URL(`/${env.S3_BUCKET}/${encodeURIComponent(key)}`, env.S3_ENDPOINT);
  url.searchParams.set("X-Amz-Expires", String(ttl));
  const signed = await aws.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
}
