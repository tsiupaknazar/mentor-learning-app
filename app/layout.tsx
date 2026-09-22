import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Fraunces } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { ConvexClientProvider } from "./convex-client-provider";
import { PostHogProvider } from "@/lib/analytics/posthog-provider";
import { siteDescription, siteName, siteUrl } from "@/lib/seo/site";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Display/headline face only — a slab-flavored serif with real ink-trap
// weight, used deliberately at large sizes for editorial authority. Never
// used for body copy or UI chrome; see globals.css principles comment.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const title = "Unsparing — learn by doing, reviewed like production code";
// Kept short/punchy for search snippets; the fuller version lives in
// siteDescription (lib/seo/site.ts) for OG/Twitter/JSON-LD, where more
// context helps the click-through decision on a link-preview card.
const description =
  "A practice-first programming mentor: diagnostic assessment, an adaptive learning path, and a strict senior-engineer code reviewer for every exercise.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s · ${siteName}`,
  },
  description,
  applicationName: siteName,
  category: "education",
  keywords: [
    "learn to code",
    "coding mentor",
    "AI code review",
    "programming practice",
    "adaptive learning path",
    "learn JavaScript",
    "learn Python",
    "learn SQL",
    "learn React",
    "coding exercises",
    "spaced repetition programming",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title,
    description: siteDescription,
    locale: "en_US",
    alternateLocale: "uk_UA",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: siteDescription,
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#0d0e0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <ConvexClientProvider>
        <PostHogProvider>
          <html lang="en" suppressHydrationWarning className={`dark ${plexSans.variable} ${plexMono.variable} ${fraunces.variable}`}>
            <body className="min-h-screen bg-background font-sans text-foreground">
              {children}
              <Analytics />
              <SpeedInsights />
            </body>
          </html>
        </PostHogProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
