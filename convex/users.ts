import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { recordDailyActivity } from "./lib/streaks";
import { awardXp as awardXpInternal } from "./lib/xp";

const skillLevel = v.union(
  v.literal("beginner"),
  v.literal("junior"),
  v.literal("intermediate"),
  v.literal("advanced")
);
const learningGoal = v.union(
  v.literal("first_job"),
  v.literal("interview_prep"),
  v.literal("improve_skills"),
  v.literal("learn_new_tech"),
  v.literal("production_skills"),
  v.literal("master_topic")
);
const learningStyle = v.union(
  v.literal("more_practice"),
  v.literal("balanced"),
  v.literal("more_theory")
);
const dailyTime = v.union(
  v.literal("15min"),
  v.literal("30min"),
  v.literal("1hr"),
  v.literal("2hr_plus")
);

/** Idempotent: called from the client right after Clerk auth resolves. */
export const getOrCreateUser = mutation({
  args: { clerkId: v.string(), email: v.string(), displayName: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      displayName: args.displayName,
      level: "beginner",
      learningGoal: "improve_skills",
      learningStyle: "balanced",
      dailyTime: "30min",
      onboardingComplete: false,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: "",
      totalXp: 0,
      createdAt: Date.now(),
    });
  },
});

export const getCurrentUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    level: skillLevel,
    learningGoal,
    learningStyle,
    dailyTime,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      level: args.level,
      learningGoal: args.learningGoal,
      learningStyle: args.learningStyle,
      dailyTime: args.dailyTime,
      onboardingComplete: true,
    });
  },
});

/**
 * Deterministic streak bookkeeping — called once per day the user does any
 * learning activity. Never delegated to the AI (spec section 20).
 */
export const recordActivity = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Streak badges newly earned by this activity (usually none).
    return await recordDailyActivity(ctx, args.userId);
  },
});

export const updatePreferences = mutation({
  args: {
    userId: v.id("users"),
    learningGoal: v.optional(learningGoal),
    learningStyle: v.optional(learningStyle),
    dailyTime: v.optional(dailyTime),
    locale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  },
  handler: async (ctx, args) => {
    const { userId, ...patch } = args;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length > 0) {
      await ctx.db.patch(userId, clean);
    }
  },
});

export const awardXp = mutation({
  args: { userId: v.id("users"), amount: v.number() },
  handler: async (ctx, args) => {
    await awardXpInternal(ctx, args.userId, args.amount);
  },
});
