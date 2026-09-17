import { describe, expect, it } from "vitest";
import { landingPageJsonLd } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/seo/site";

describe("landingPageJsonLd", () => {
  it("produces an Organization, WebSite, and SoftwareApplication graph anchored to siteUrl", () => {
    const jsonLd = landingPageJsonLd();

    expect(jsonLd["@context"]).toBe("https://schema.org");
    const types = jsonLd["@graph"].map((entry) => entry["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    for (const entry of jsonLd["@graph"]) {
      expect(entry.url).toBe(siteUrl);
    }
  });

  it("supports both locales on the WebSite entry", () => {
    const jsonLd = landingPageJsonLd();
    const website = jsonLd["@graph"].find((e) => e["@type"] === "WebSite");
    expect(website?.inLanguage).toEqual(["en", "uk"]);
  });
});
