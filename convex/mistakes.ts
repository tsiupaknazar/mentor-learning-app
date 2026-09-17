import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { awardAchievement, ACHIEVEMENT_KEYS } from "./lib/achievements";

// Consecutive correct, non-recurring attempts on a mistake's topic before
// it's deterministically marked resolved. Mirrors the "3 occurrences ->
// needs_review" escalation threshold below for symmetry.
const RESOLVE_THRESHOLD = 3;
const MISTAKES_RESOLVED_FOR_SLAYER = 5;

/** Bumps the user's lifetime resolved-mistake counter and awards the mistake_slayer badge at the threshold. Called whenever a mistake's status becomes "resolved", auto or manual. */
async function trackMistakeResolved(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const newTotal = (user.totalMistakesResolved ?? 0) + 1;
  await ctx.db.patch(userId, { totalMistakesResolved: newTotal });
  if (newTotal >= MISTAKES_RESOLVED_FOR_SLAYER) {
    await awardAchievement(ctx, userId, ACHIEVEMENT_KEYS.mistakeSlayer);
  }
}

/**
 * Called internally from `attempts.recordAttempt` when Gemini's evaluation
 * includes a `detectedMisconception`. Matches against the user's existing
 * mistakes for the same topic by `key` (a stable, language-independent
 * identifier — see schema.ts's mistakes.key comment) when both sides have
 * one, falling back to exact description match otherwise. Simple by
 * design; a future pass could use embedding similarity, but a model-
 * generated stable key is a reasonable MVP heuristic and keeps this fully
 * deterministic (no extra AI call just to dedupe).
 */
export const upsertMistake = internalMutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    description: v.string(),
    attemptId: v.id("attempts"),
    // The locale `description` was actually generated in — see
    // schema.ts's mistakes.contentLocale comment. Only stamped on the
    // initial insert; a recurrence reuses the existing row (matched by
    // key, or by description as a fallback — see below) rather than
    // overwriting it.
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
    // Stable, English, language-independent identifier for this
    // misconception — see schema.ts's mistakes.key comment. Optional
    // since older evaluate calls (and any response where Gemini omitted
    // it) won't have one.
    key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("mistakes")
      .withIndex("by_user_and_topic", (q) => q.eq("userId", args.userId).eq("topicId", args.topicId))
      .collect();
    // Prefer matching on the language-independent key when both this
    // detection and the existing row have one — this is what makes a
    // recurring mistake keep incrementing instead of forking into a
    // duplicate after the learner switches locale, since `description`
    // itself is prose that changes wording across languages. Falls back
    // to exact description match (the original behavior) whenever either
    // side lacks a key — pre-migration rows, or a response where Gemini
    // didn't return one.
    const existing = candidates.find((m) =>
      args.key && m.key ? m.key === args.key : m.description === args.description
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        occurrences: existing.occurrences + 1,
        lastDetectedAt: Date.now(),
        // Backfill a key onto a pre-migration row the first time one
        // becomes available, without disturbing rows that already have
        // one (or overwriting with undefined if this detection lacks one).
        key: existing.key ?? args.key,
        // Recurring after having been resolved un-resolves it — it's back.
        status: existing.occurrences + 1 >= 3 ? "needs_review" : "open",
        relatedAttemptIds: [...existing.relatedAttemptIds, args.attemptId],
        // It just recurred, so any resolution progress is wiped.
        consecutiveCleanAttempts: 0,
        resolvedAt: undefined,
      });
      return { mistakeId: existing._id, occurrences: existing.occurrences + 1 };
    }

    const mistakeId = await ctx.db.insert("mistakes", {
      userId: args.userId,
      topicId: args.topicId,
      description: args.description,
      key: args.key,
      firstDetectedAt: Date.now(),
      lastDetectedAt: Date.now(),
      occurrences: 1,
      status: "open",
      relatedAttemptIds: [args.attemptId],
      consecutiveCleanAttempts: 0,
      contentLocale: args.contentLocale,
    });
    return { mistakeId, occurrences: 1 };
  },
});

/**
 * Called internally from `attempts.recordAttempt` for every attempt, for
 * every one of the user's open/needs_review mistakes on that attempt's
 * topic. A mistake auto-resolves once it hits RESOLVE_THRESHOLD correct
 * attempts in a row on its topic that didn't reproduce it — deterministic
 * counting, no AI judgment call about whether the learner "really" gets it
 * now (same reasoning as mastery scoring: the app decides what the numbers
 * mean, Gemini only supplies the per-attempt score/misconception).
 *
 * `recurredKey`/`recurredDescription` identify the mistake `upsertMistake`
 * just handled in this same attempt (if any) — skipped here so a
 * just-recurred mistake doesn't also get a clean-attempt increment in the
 * same call. Matched the same key-first, description-fallback way as
 * upsertMistake, for the same cross-locale reason.
 */
export const advanceResolutionProgress = internalMutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    wasClean: v.boolean(),
    recurredDescription: v.optional(v.string()),
    recurredKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.wasClean) return;

    const candidates = await ctx.db
      .query("mistakes")
      .withIndex("by_user_and_topic", (q) => q.eq("userId", args.userId).eq("topicId", args.topicId))
      .filter((q) => q.neq(q.field("status"), "resolved"))
      .collect();

    for (const mistake of candidates) {
      const justRecurred =
        args.recurredKey && mistake.key
          ? mistake.key === args.recurredKey
          : mistake.description === args.recurredDescription;
      if (justRecurred) continue;
      const next = (mistake.consecutiveCleanAttempts ?? 0) + 1;
      if (next >= RESOLVE_THRESHOLD) {
        await ctx.db.patch(mistake._id, {
          consecutiveCleanAttempts: next,
          status: "resolved",
          resolvedAt: Date.now(),
        });
        await trackMistakeResolved(ctx, args.userId);
      } else {
        await ctx.db.patch(mistake._id, { consecutiveCleanAttempts: next });
      }
    }
  },
});

/**
 * Learner-initiated override for when they're confident they've got it and
 * don't want to wait out RESOLVE_THRESHOLD more attempts (or the topic
 * simply won't come up again soon). Ownership-checked: only the mistake's
 * own user can resolve it.
 */
export const markMistakeResolved = mutation({
  args: { userId: v.id("users"), mistakeId: v.id("mistakes") },
  handler: async (ctx, args) => {
    const mistake = await ctx.db.get(args.mistakeId);
    if (!mistake || mistake.userId !== args.userId) {
      throw new Error("Mistake not found.");
    }
    if (mistake.status === "resolved") return;
    await ctx.db.patch(args.mistakeId, { status: "resolved", resolvedAt: Date.now() });
    await trackMistakeResolved(ctx, args.userId);
  },
});

export const getMistake = query({
  args: { mistakeId: v.id("mistakes") },
  handler: async (ctx, args) => ctx.db.get(args.mistakeId),
});

export const listOpenMistakes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const open = await ctx.db
      .query("mistakes")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "open"))
      .collect();
    const needsReview = await ctx.db
      .query("mistakes")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "needs_review"))
      .collect();
    return [...needsReview, ...open].sort((a, b) => b.occurrences - a.occurrences);
  },
});

/** Most recently resolved mistakes, for a small "recently resolved" list — positive reinforcement, not just a growing pile of open ones. */
export const listResolvedMistakes = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const resolved = await ctx.db
      .query("mistakes")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "resolved"))
      .collect();
    return resolved.sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)).slice(0, args.limit ?? 5);
  },
});

