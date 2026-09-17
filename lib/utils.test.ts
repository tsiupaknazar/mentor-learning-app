import { describe, expect, it } from "vitest";
import { cn, formatMastery, masteryBand } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatMastery", () => {
  it("scales a 0-1 value to a percentage", () => {
    expect(formatMastery(0.5)).toBe("50%");
    expect(formatMastery(0)).toBe("0%");
  });

  it("treats exactly 1 as the 0-1 scale (100%), per the documented heuristic", () => {
    expect(formatMastery(1)).toBe("100%");
  });

  it("passes a value already on the 0-100 scale through unchanged", () => {
    expect(formatMastery(42)).toBe("42%");
    expect(formatMastery(100)).toBe("100%");
  });

  it("rounds to the nearest whole percent", () => {
    expect(formatMastery(0.333)).toBe("33%");
    expect(formatMastery(66.6)).toBe("67%");
  });
});

describe("masteryBand", () => {
  it("returns strong at and above 75", () => {
    expect(masteryBand(75)).toBe("strong");
    expect(masteryBand(100)).toBe("strong");
  });

  it("returns medium between 45 and 74", () => {
    expect(masteryBand(74.9)).toBe("medium");
    expect(masteryBand(45)).toBe("medium");
  });

  it("returns weak below 45", () => {
    expect(masteryBand(44.9)).toBe("weak");
    expect(masteryBand(0)).toBe("weak");
  });
});
