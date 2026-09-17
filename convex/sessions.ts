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

export const incrementSessionProgress = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;
    const exercisesCompleted = session.exercisesCompleted + 1;
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

export const listRecentSessions = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 10);
  },
});
