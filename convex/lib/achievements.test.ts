import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_KEYS } from "@/convex/lib/achievements";

// The async ctx.db-dependent functions in this file (awardAchievement,
// awardXpMilestones, awardStreakMilestones) are tested in
// convex/achievements.test.ts via convex-test, since they need a real
// database. This file only covers the pure, static data.

describe("ACHIEVEMENT_KEYS", () => {
  it("has exactly the 9 documented achievement keys", () => {
    expect(Object.keys(ACHIEVEMENT_KEYS)).toHaveLength(9);
    expect(Object.values(ACHIEVEMENT_KEYS)).toEqual([
      "first_win",
      "perfect_five",
      "streak_7",
      "streak_30",
      "first_mastery",
      "mistake_slayer",
      "project_shipped",
      "xp_500",
      "xp_2000",
    ]);
  });

  it("every value is unique", () => {
    const values = Object.values(ACHIEVEMENT_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});
