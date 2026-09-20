import { describe, expect, it } from "vitest";
import { pickScaffolding } from "@/lib/scaffolding";

describe("pickScaffolding", () => {
  it("fades a beginner's support over their first two exercises on a topic", () => {
    expect(pickScaffolding("beginner", 0, false)).toBe(0);
    expect(pickScaffolding("beginner", 1, false)).toBe(1);
    expect(pickScaffolding("beginner", 2, false)).toBeNull();
    expect(pickScaffolding("beginner", 30, false)).toBeNull();
  });

  it("never scaffolds a harder variation", () => {
    expect(pickScaffolding("beginner", 0, true)).toBeNull();
  });

  it("never scaffolds anyone above beginner", () => {
    for (const level of ["junior", "intermediate", "advanced"] as const) {
      expect(pickScaffolding(level, 0, false)).toBeNull();
    }
  });
});
