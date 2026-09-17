import { siteDescription, siteName, siteUrl } from "@/lib/seo/site";

export function landingPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: siteName,
        url: siteUrl,
        logo: `${siteUrl}/icon`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: siteName,
        description: siteDescription,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: ["en", "uk"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: siteName,
        url: siteUrl,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        description: siteDescription,
      },
    ],
  };
}
