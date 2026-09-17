import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { awardXpMilestones } from "./achievements";

/** Adds `amount` XP to `userId` and awards any XP-milestone badges it now crosses. No-ops for amount <= 0. */
export async function awardXp(ctx: MutationCtx, userId: Id<"users">, amount: number) {
  if (amount <= 0) return;
  const user = await ctx.db.get(userId);
  if (!user) return;
  const newTotal = user.totalXp + amount;
  await ctx.db.patch(userId, { totalXp: newTotal });
  await awardXpMilestones(ctx, userId, newTotal);
}
