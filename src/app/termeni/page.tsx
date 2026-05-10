import type { Metadata } from "next";

import { LegalViewedTracker } from "@/components/analytics/page-trackers";
import { Dateline } from "@/components/dateline";
import { env } from "@/env";

import Content from "./content.mdx";

export const revalidate = 3600;

const TITLE = "Termeni de utilizare";
const DESCRIPTION =
  "Termenii care guvernează utilizarea monitorul.ai, contribuțiile prin Stripe și transferul bancar, accesul la serverul MCP, refuzul contribuțiilor și răspunderea operatorului.";
const UPDATED = "10 mai 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/termeni" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    locale: "ro_RO",
    url: "/termeni",
  },
};

export default function TermeniPage() {
  return (
    <article className="mx-auto w-full max-w-(--breakpoint-md) px-6 py-12 sm:py-16">
      <TermeniJsonLd />
      <LegalViewedTracker page="termeni" />

      <Dateline parts={["Notă legală", "Monitorul.ai", `Actualizat ${UPDATED}`]} />

      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-3xl leading-[1.1] text-ink-16 sm:text-4xl lg:text-5xl">
          {TITLE}
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-30">{DESCRIPTION}</p>
      </header>

      <div className="prose-mono mt-10">
        <Content />
      </div>
    </article>
  );
}

function TermeniJsonLd() {
  const url = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/termeni`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#terms`,
    name: TITLE,
    description: DESCRIPTION,
    url,
    inLanguage: "ro",
    isPartOf: {
      "@type": "WebSite",
      name: "monitorul.ai",
      url: env.NEXT_PUBLIC_SITE_URL,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
