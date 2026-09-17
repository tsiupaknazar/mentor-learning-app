// Falls back to a placeholder so builds never fail before NEXT_PUBLIC_SITE_URL
// is set, but every canonical URL, OG tag, and sitemap entry is wrong until
// you set it to your real deploy domain (no trailing slash) in .env.local /
// your hosting provider's env settings.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://unsparing.example.com").replace(
  /\/$/,
  ""
);

export const siteName = "Unsparing";
export const siteDescription =
  "A practice-first programming mentor: diagnostic assessment, an adaptive learning path, and a strict senior-engineer code reviewer for every exercise — not another lecture-and-quiz course.";
