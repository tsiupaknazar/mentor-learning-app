import { query } from "./_generated/server";
import { v } from "convex/values";

export const listAchievements = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.sort((a, b) => b.earnedAt - a.earnedAt);
  },
});
