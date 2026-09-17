import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test-helpers";
import {
  awardAchievement,
  awardXpMilestones,
  awardStreakMilestones,
  ACHIEVEMENT_KEYS,
} from "./lib/achievements";

describe("listAchievements", () => {
  it("returns an empty list for a user with no achievements", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const result = await t.query(api.achievements.listAchievements, { userId });

    expect(result).toEqual([]);
  });

  it("returns achievements newest-first", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("achievements", { userId, key: "firstWin", earnedAt: 100 });
      await ctx.db.insert("achievements", { userId, key: "streak_7", earnedAt: 200 });
    });

    const result = await t.query(api.achievements.listAchievements, { userId });

    expect(result.map((a) => a.key)).toEqual(["streak_7", "firstWin"]);
  });
});

describe("awardAchievement", () => {
  it("is idempotent: a second award of the same key does not insert a duplicate", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    await t.run((ctx) => awardAchievement(ctx, userId, ACHIEVEMENT_KEYS.firstWin));
    await t.run((ctx) => awardAchievement(ctx, userId, ACHIEVEMENT_KEYS.firstWin));

    const result = await t.query(api.achievements.listAchievements, { userId });
    expect(result).toHaveLength(1);
  });
});

describe("awardXpMilestones", () => {
  it("does not award xp_500 just below the threshold", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.run((ctx) => awardXpMilestones(ctx, userId, 499));
    const result = await t.query(api.achievements.listAchievements, { userId });
    expect(result.map((a) => a.key)).not.toContain("xp_500");
  });

  it("awards xp_500 at exactly the threshold, but not yet xp_2000", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.run((ctx) => awardXpMilestones(ctx, userId, 500));
    const result = await t.query(api.achievements.listAchievements, { userId });
    expect(result.map((a) => a.key)).toEqual(["xp_500"]);
  });

  it("awards both xp_500 and xp_2000 at the higher threshold", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.run((ctx) => awardXpMilestones(ctx, userId, 2000));
    const result = await t.query(api.achievements.listAchievements, { userId });
    expect(result.map((a) => a.key).sort()).toEqual(["xp_2000", "xp_500"]);
  });
});

describe("awardStreakMilestones", () => {
  it("does not award streak_7 just below the threshold", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.run((ctx) => awardStreakMilestones(ctx, userId, 6));
    const result = await t.query(api.achievements.listAchievements, { userId });
    expect(result.map((a) => a.key)).not.toContain("streak_7");
  });

  it("awards streak_7 at exactly 7 days, but not yet streak_30", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.run((ctx) => awardStreakMilestones(ctx, userId, 7));
    const result = await t.query(api.achievements.listAchievements, { userId });
    expect(result.map((a) => a.key)).toEqual(["streak_7"]);
  });

  it("awards both streak_7 and streak_30 at 30 days", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.run((ctx) => awardStreakMilestones(ctx, userId, 30));
    const result = await t.query(api.achievements.listAchievements, { userId });
    expect(result.map((a) => a.key).sort()).toEqual(["streak_30", "streak_7"]);
  });
});
