import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { awardStreakMilestones, type AchievementKey } from "./achievements";

/**
 * Records that `userId` did *something* substantive today (an exercise
 * attempt or a project task submission) and updates their daily streak.
 * Shared between `users.recordActivity` (called from `/api/evaluate`) and
 * `projects.recordSubmissionAndReview`, so a day spent entirely on a
 * project counts toward the streak same as a day spent on exercises —
 * previously only exercises did.
 *
 * A no-op past the first call of the day (checked via `lastActiveDate`),
 * so it's safe to call once per attempt/submission without extra guards
 * at the call site. Returns any streak badges newly earned by this call.
 */
export async function recordDailyActivity(ctx: MutationCtx, userId: Id<"users">): Promise<AchievementKey[]> {
  const user = await ctx.db.get(userId);
  if (!user) return [];

  const today = new Date().toISOString().slice(0, 10);
  if (user.lastActiveDate === today) return []; // already recorded today

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const continuesStreak = user.lastActiveDate === yesterday;
  const newStreak = continuesStreak ? user.currentStreak + 1 : 1;

  await ctx.db.patch(userId, {
    lastActiveDate: today,
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, user.longestStreak),
  });

  return await awardStreakMilestones(ctx, userId, newStreak);
}
