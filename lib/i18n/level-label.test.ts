import { describe, expect, it } from "vitest";
import { dictionaries, levelLabel } from "./dictionaries";

describe("levelLabel", () => {
  it("returns the localized name for every stored skill level, in both languages", () => {
    for (const locale of ["en", "uk"] as const) {
      const t = dictionaries[locale];
      for (const level of ["beginner", "junior", "intermediate", "advanced"] as const) {
        expect(levelLabel(t, level)).toBe(t.onboarding.levels[level]);
      }
    }
  });

  it("actually differs between languages (i.e. is not the raw key)", () => {
    expect(levelLabel(dictionaries.en, "junior")).toBe("Junior");
    expect(levelLabel(dictionaries.uk, "junior")).not.toBe("junior");
    expect(levelLabel(dictionaries.uk, "junior")).not.toBe(levelLabel(dictionaries.en, "junior"));
  });

  it("falls back to the raw value for one it doesn't know", () => {
    expect(levelLabel(dictionaries.en, "wizard")).toBe("wizard");
  });
});
