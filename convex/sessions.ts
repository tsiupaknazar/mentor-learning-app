import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const startSession = mutation({
  args: { userId: v.id("users"), topicId: v.id("topics"), objective: v.string(), exercisesPlanned: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      userId: args.userId,
      topicId: args.topicId,
      objective: args.objective,
      startedAt: Date.now(),
      exercisesPlanned: args.exercisesPlanned,
      exercisesCompleted: 0,
    });
  },
});

/**
 * Counts one more exercise as done in the session. When `exerciseId` is
 * given, only the exercise's FIRST attempt counts: "Revise and resubmit"
 * submits the same exercise again, and counting each submission made a
 * revised exercise use up two of the session's slots (finishing it early,
 * or showing "7 / 5"). The attempt has already been recorded by the time
 * this runs, so more than one attempt means it was counted before.
 */
export const incrementSessionProgress = mutation({
  args: { sessionId: v.id("sessions"), exerciseId: v.optional(v.id("exercises")) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;
    if (args.exerciseId) {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId!))
        .collect();
      if (attempts.length > 1) return;
    }
    const exercisesCompleted = Math.min(session.exercisesCompleted + 1, session.exercisesPlanned);
    await ctx.db.patch(args.sessionId, {
      exercisesCompleted,
      completedAt: exercisesCompleted >= session.exercisesPlanned ? Date.now() : session.completedAt,
    });
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => ctx.db.get(args.sessionId),
});

/** Newest first, each with its topic's title (every session's stored `objective` is the same sentence, so it can't tell them apart). */
export const listRecentSessions = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 10);

    const titles = new Map<string, string | null>();
    for (const topicId of new Set(sessions.map((s) => s.topicId))) {
      titles.set(topicId, (await ctx.db.get(topicId))?.title ?? null);
    }
    return sessions.map((s) => ({ ...s, topicTitle: titles.get(s.topicId) ?? null }));
  },
});
