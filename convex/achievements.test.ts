import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test-helpers";

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
