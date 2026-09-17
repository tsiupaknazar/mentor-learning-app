import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV;
  vi.resetModules();
});

describe("siteUrl", () => {
  it("falls back to the placeholder domain when unset", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
    const { siteUrl } = await import("@/lib/seo/site");
    expect(siteUrl).toBe("https://unsparing.example.com");
  });

  it("uses the real env value as-is when it has no trailing slash", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    vi.resetModules();
    const { siteUrl } = await import("@/lib/seo/site");
    expect(siteUrl).toBe("https://example.com");
  });

  it("strips a trailing slash from the env value", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    vi.resetModules();
    const { siteUrl } = await import("@/lib/seo/site");
    expect(siteUrl).toBe("https://example.com");
  });
});
