import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Every achievement key the app can award. Titles/descriptions live in the
 * i18n dictionaries (`lib/i18n/dictionaries.ts`'s `achievements.catalog`),
 * keyed by these same strings — never stored on the row itself, see
 * schema.ts's comment on the `achievements` table for why.
 */
export const ACHIEVEMENT_KEYS = {
  firstWin: "first_win",
  perfectFive: "perfect_five",
  streak7: "streak_7",
  streak30: "streak_30",
  firstMastery: "first_mastery",
  mistakeSlayer: "mistake_slayer",
  projectShipped: "project_shipped",
  xp500: "xp_500",
  xp2000: "xp_2000",
} as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[keyof typeof ACHIEVEMENT_KEYS];

/**
 * Awards `key` to `userId` if they don't already have it. Idempotent via
 * the `by_user_and_key` index, so every call site below can just say "this
 * condition is true, award it" without first checking whether it already
 * happened — same deterministic-counters approach as mastery scoring and
 * spaced repetition (`convex/lib/mastery.ts`): Gemini never decides whether
 * an achievement was earned, the app does, from state it already tracks.
 */
export async function awardAchievement(ctx: MutationCtx, userId: Id<"users">, key: AchievementKey) {
  const existing = await ctx.db
    .query("achievements")
    .withIndex("by_user_and_key", (q) => q.eq("userId", userId).eq("key", key))
    .unique();
  if (existing) return;
  await ctx.db.insert("achievements", { userId, key, earnedAt: Date.now() });
}

/** Awards whichever XP-milestone badges `totalXp` now qualifies for. */
export async function awardXpMilestones(ctx: MutationCtx, userId: Id<"users">, totalXp: number) {
  if (totalXp >= 500) await awardAchievement(ctx, userId, ACHIEVEMENT_KEYS.xp500);
  if (totalXp >= 2000) await awardAchievement(ctx, userId, ACHIEVEMENT_KEYS.xp2000);
}

/** Awards whichever streak badges `currentStreak` (consecutive active days) now qualifies for. */
export async function awardStreakMilestones(ctx: MutationCtx, userId: Id<"users">, currentStreak: number) {
  if (currentStreak >= 7) await awardAchievement(ctx, userId, ACHIEVEMENT_KEYS.streak7);
  if (currentStreak >= 30) await awardAchievement(ctx, userId, ACHIEVEMENT_KEYS.streak30);
}
