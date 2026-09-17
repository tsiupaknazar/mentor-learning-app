import { describe, expect, it } from "vitest";
import { masteryBand } from "@/convex/lib/bands";

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
