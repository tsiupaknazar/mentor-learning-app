import { describe, expect, it } from "vitest";
import { dictionaries, getDictionary } from "@/lib/i18n/dictionaries";
import { ACHIEVEMENT_KEYS } from "@/convex/lib/achievements";
import type { Locale } from "@/lib/i18n/dictionaries";

describe("getDictionary", () => {
  it("returns the matching dictionary for a known locale", () => {
    expect(getDictionary("uk")).toBe(dictionaries.uk);
  });

  it("falls back to en for an unrecognized locale", () => {
    expect(getDictionary("fr" as Locale)).toBe(dictionaries.en);
  });
});

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "function") return [];
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
    collectKeyPaths(v, prefix ? `${prefix}.${key}` : key)
  );
}

describe("en/uk structural parity", () => {
  it("every key path present in en is also present in uk, and vice versa", () => {
    const enPaths = new Set(collectKeyPaths(dictionaries.en));
    const ukPaths = new Set(collectKeyPaths(dictionaries.uk));

    const missingFromUk = [...enPaths].filter((p) => !ukPaths.has(p));
    const missingFromEn = [...ukPaths].filter((p) => !enPaths.has(p));

    expect(missingFromUk, "keys present in en but missing from uk").toEqual([]);
    expect(missingFromEn, "keys present in uk but missing from en").toEqual([]);
  });
});

describe("achievements catalog / ACHIEVEMENT_KEYS consistency", () => {
  it("every ACHIEVEMENT_KEYS value has a matching catalog entry in both locales", () => {
    const achievementValues = Object.values(ACHIEVEMENT_KEYS);
    for (const locale of ["en", "uk"] as const) {
      const catalogKeys = Object.keys(dictionaries[locale].achievements.catalog);
      for (const key of achievementValues) {
        expect(catalogKeys, `${locale} catalog missing "${key}"`).toContain(key);
      }
    }
  });
});
