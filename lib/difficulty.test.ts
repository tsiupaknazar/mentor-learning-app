import { describe, expect, it } from "vitest";
import { pickDifficulty } from "@/lib/difficulty";

describe("pickDifficulty", () => {
  it("always picks easy for a first attempt regardless of mastery", () => {
    expect(pickDifficulty(90, 0)).toBe("easy");
    expect(pickDifficulty(0, 0)).toBe("easy");
  });

  it("picks easy below 35 mastery once there have been attempts", () => {
    expect(pickDifficulty(34, 5)).toBe("easy");
  });

  it("picks medium between 35 and 59 mastery", () => {
    expect(pickDifficulty(35, 5)).toBe("medium");
    expect(pickDifficulty(59, 5)).toBe("medium");
  });

  it("picks hard between 60 and 84 mastery", () => {
    expect(pickDifficulty(60, 5)).toBe("hard");
    expect(pickDifficulty(84, 5)).toBe("hard");
  });

  it("picks interview at 85+ mastery", () => {
    expect(pickDifficulty(85, 5)).toBe("interview");
    expect(pickDifficulty(100, 5)).toBe("interview");
  });

  describe("challengeMode", () => {
    it("bumps the base difficulty one rung up the ladder", () => {
      expect(pickDifficulty(0, 0, true)).toBe("medium");
      expect(pickDifficulty(40, 5, true)).toBe("hard");
      expect(pickDifficulty(70, 5, true)).toBe("interview");
    });

    it("clamps at real_world instead of running off the end of the ladder", () => {
      expect(pickDifficulty(90, 5, true)).toBe("real_world");
    });
  });
});
