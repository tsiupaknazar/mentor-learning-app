import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything below requires a Clerk session (see middleware.ts) and
      // has no unique content for a crawler to index anyway — keep it out
      // of crawl budget entirely rather than relying on noindex meta tags
      // on pages a bot may never render past the auth redirect.
      disallow: [
        "/api/",
        "/onboarding",
        "/dashboard",
        "/learn",
        "/practice",
        "/mistakes",
        "/progress",
        "/projects",
        "/settings",
        "/knowledge-map",
        "/interview",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
