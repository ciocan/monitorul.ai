import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";

import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { env } from "@/env";
import { cn } from "@/lib/utils";

import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "monitorul.ai · Arhiva publică a Monitorului Oficial Partea a II-a",
    template: "%s · monitorul.ai",
  },
  description:
    "Arhivă publică a stenogramelor parlamentare din România. Caută discursuri, voturi, interpelări, întrebări scrise, ședințe de comisie și rapoarte — citabile, durabile, verificabile.",
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "monitorul.ai",
  },
  robots: { index: true, follow: true },
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ro"
      className={cn(
        "h-full",
        "antialiased",
        publicSans.variable,
        sourceSerif.variable,
        plexMono.variable,
        "font-sans",
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <ScrollToTop />
      </body>
    </html>
  );
}
