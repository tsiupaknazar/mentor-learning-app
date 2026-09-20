import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { EMPTY_MASTERY, nextReviewDelayMs, updateMasteryFromAttempt } from "./lib/mastery";
import { awardAchievement, ACHIEVEMENT_KEYS, type AchievementKey } from "./lib/achievements";
import { awardXp } from "./lib/xp";

const NO_HINT_STREAK_FOR_PERFECT_FIVE = 5;

const scoreValidator = v.object({
  correctness: v.number(),
  logic: v.number(),
  codeQuality: v.number(),
  bestPractices: v.number(),
  edgeCaseHandling: v.number(),
});

const feedbackValidator = v.object({
  whatYouDid: v.string(),
  problem: v.optional(v.string()),
  whyItMatters: v.optional(v.string()),
  hint: v.optional(v.string()),
  nextStep: v.string(),
  detectedMisconception: v.optional(v.string()),
  detectedMisconceptionKey: v.optional(v.string()),
  mentorFollowUp: v.optional(v.string()),
});

/**
 * Records a submitted answer + its Gemini evaluation (already validated by
 * `evaluationSchema` in the API route before this mutation is ever called).
 * This single mutation is the deterministic core of the learning loop:
 * it updates topic mastery, schedules spaced repetition, tracks recurring
 * mistakes, and awards XP and achievements — none of which the AI computes
 * itself.
 */
export const recordAttempt = mutation({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    topicId: v.id("topics"),
    submittedAnswer: v.string(),
    hintsUsed: v.number(),
    solutionRevealed: v.boolean(),
    result: v.union(v.literal("correct"), v.literal("partially_correct"), v.literal("incorrect")),
    scores: scoreValidator,
    feedback: feedbackValidator,
    exerciseType: v.string(),
    // Threaded through to mistakes.upsertMistake — see its contentLocale
    // comment. Optional for backward compatibility.
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  },
  handler: async (ctx, args) => {
    // Having been shown the solution is remembered on the exercise, so it
    // counts even if the client reports otherwise (or forgets, after a reload).
    const exercise = await ctx.db.get(args.exerciseId);
    const solutionRevealed = args.solutionRevealed || exercise?.solutionRevealedAt !== undefined;

    const attemptId = await ctx.db.insert("attempts", {
      userId: args.userId,
      exerciseId: args.exerciseId,
      topicId: args.topicId,
      submittedAnswer: args.submittedAnswer,
      hintsUsed: args.hintsUsed,
      solutionRevealed,
      result: args.result,
      scores: args.scores,
      feedback: args.feedback,
      submittedAt: Date.now(),
    });

    // --- Session outcome: each exercise counts once, when it first succeeds ---
    if (args.result !== "incorrect" && exercise?.sessionId) {
      const attemptsOnExercise = await ctx.db
        .query("attempts")
        .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId))
        .collect();
      const alreadyCounted = attemptsOnExercise.some((a) => a._id !== attemptId && a.result !== "incorrect");
      const session = alreadyCounted ? null : await ctx.db.get(exercise.sessionId);
      if (session) {
        await ctx.db.patch(session._id, { exercisesSucceeded: (session.exercisesSucceeded ?? 0) + 1 });
      }
    }

    // --- Deterministic mastery update -------------------------------
    const progress = await ctx.db
      .query("topicProgress")
      .withIndex("by_user_and_topic", (q) => q.eq("userId", args.userId).eq("topicId", args.topicId))
      .unique();

    const previousMastery = progress?.mastery ?? EMPTY_MASTERY;
    const hasAttemptedBefore = (progress?.attemptsCount ?? 0) > 0;
    const newMastery = updateMasteryFromAttempt(
      previousMastery,
      args.scores,
      args.exerciseType,
      hasAttemptedBefore
    );

    // What this attempt newly earned - returned so the UI can show it.
    const newAchievements: AchievementKey[] = [];
    let xpAwarded = 0;

    const wasCorrect = args.result === "correct";
    const nextReviewDue = Date.now() + nextReviewDelayMs(newMastery.overall, wasCorrect);
    const wasAlreadyMastered = progress?.status === "mastered";
    const status =
      newMastery.overall >= 85
        ? ("mastered" as const)
        : wasCorrect
          ? ("in_progress" as const)
          : ("needs_review" as const);

    if (progress) {
      await ctx.db.patch(progress._id, {
        mastery: newMastery,
        attemptsCount: progress.attemptsCount + 1,
        lastAttemptAt: Date.now(),
        nextReviewDue,
        status,
      });
    } else {
      await ctx.db.insert("topicProgress", {
        userId: args.userId,
        topicId: args.topicId,
        mastery: newMastery,
        attemptsCount: 1,
        lastAttemptAt: Date.now(),
        nextReviewDue,
        status,
      });
    }

    // --- Achievements: mastery (section 26) --------------------------
    if (status === "mastered" && !wasAlreadyMastered) {
      if (await awardAchievement(ctx, args.userId, ACHIEVEMENT_KEYS.firstMastery)) {
        newAchievements.push(ACHIEVEMENT_KEYS.firstMastery);
      }
    }

    // --- Recurring mistake tracking (section 18) ---------------------
    if (args.feedback.detectedMisconception) {
      await ctx.runMutation(internal.mistakes.upsertMistake, {
        userId: args.userId,
        topicId: args.topicId,
        description: args.feedback.detectedMisconception,
        attemptId,
        contentLocale: args.contentLocale,
        key: args.feedback.detectedMisconceptionKey,
      });
    }

    // A correct attempt that didn't reproduce any open mistake on this
    // topic counts as "clean" progress toward auto-resolving those
    // mistakes. Runs even when this attempt DID detect a (different or new)
    // misconception — only the specific mistake that just recurred above is
    // excluded, via `recurredDescription`.
    await ctx.runMutation(internal.mistakes.advanceResolutionProgress, {
      userId: args.userId,
      topicId: args.topicId,
      wasClean: wasCorrect,
      recurredDescription: args.feedback.detectedMisconception,
      recurredKey: args.feedback.detectedMisconceptionKey,
    });

    // --- XP: only meaningful accomplishment earns XP (section 26) ---
    const user = await ctx.db.get(args.userId);
    if (user) {
      let xp = 0;
      const wasCleanCorrect = args.result === "correct" && args.hintsUsed === 0 && !solutionRevealed;
      if (args.result === "correct") {
        xp += wasCleanCorrect ? 100 : 40;
      } else if (args.result === "partially_correct") {
        xp += 15;
      }
      if (xp > 0) {
        newAchievements.push(...(await awardXp(ctx, args.userId, xp)));
        xpAwarded = xp;
      }

      // --- Achievements: streaks of accomplishment (section 26) ------
      const newTotalCorrect = (user.totalCorrectAttempts ?? 0) + (wasCorrect ? 1 : 0);
      const newNoHintStreak = wasCleanCorrect ? (user.currentNoHintStreak ?? 0) + 1 : 0;
      await ctx.db.patch(args.userId, {
        totalCorrectAttempts: newTotalCorrect,
        currentNoHintStreak: newNoHintStreak,
      });
      if (newTotalCorrect === 1 && (await awardAchievement(ctx, args.userId, ACHIEVEMENT_KEYS.firstWin))) {
        newAchievements.push(ACHIEVEMENT_KEYS.firstWin);
      }
      if (
        newNoHintStreak >= NO_HINT_STREAK_FOR_PERFECT_FIVE &&
        (await awardAchievement(ctx, args.userId, ACHIEVEMENT_KEYS.perfectFive))
      ) {
        newAchievements.push(ACHIEVEMENT_KEYS.perfectFive);
      }
    }

    return {
      attemptId,
      mastery: newMastery,
      masteryBefore: previousMastery.overall,
      xpAwarded,
      newAchievements,
    };
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVITY_DAYS = 400;

/**
 * How many answers the learner submitted on each of the last `days` days
 * (UTC dates, matching how daily streaks are counted), and how many of those
 * were correct. Only days with activity are returned, oldest first.
 */
export const activityByDay = query({
  args: { userId: v.id("users"), days: v.number() },
  handler: async (ctx, args) => {
    const days = Math.max(1, Math.min(Math.floor(args.days), MAX_ACTIVITY_DAYS));
    const startOfToday = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    const since = startOfToday - (days - 1) * DAY_MS;

    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_user_and_submitted", (q) => q.eq("userId", args.userId).gte("submittedAt", since))
      .collect();

    const byDate = new Map<string, { count: number; correct: number }>();
    for (const a of attempts) {
      const date = new Date(a.submittedAt).toISOString().slice(0, 10);
      const day = byDate.get(date) ?? { count: 0, correct: 0 };
      day.count += 1;
      if (a.result === "correct") day.correct += 1;
      byDate.set(date, day);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
  },
});

/** Every attempt on one exercise, newest first. */
export const listAttemptsForExercise = query({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attempts")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId))
      .order("desc")
      .collect();
  },
});

export const listAttemptsForTopic = query({
  args: { userId: v.id("users"), topicId: v.id("topics") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attempts")
      .withIndex("by_user_and_topic", (q) => q.eq("userId", args.userId).eq("topicId", args.topicId))
      .order("desc")
      .collect();
  },
});
