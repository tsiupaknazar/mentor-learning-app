import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const exerciseType = v.union(
  v.literal("multiple_choice"),
  v.literal("code_prediction"),
  v.literal("code_completion"),
  v.literal("debugging"),
  v.literal("refactoring"),
  v.literal("implementation"),
  v.literal("architecture_decision"),
  v.literal("explain_code"),
  v.literal("find_the_bug"),
  v.literal("compare_implementations"),
  v.literal("optimize_code"),
  v.literal("write_tests"),
  v.literal("review_code")
);
const exerciseDifficulty = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
  v.literal("interview"),
  v.literal("real_world")
);
const programmingLanguage = v.union(
  v.literal("javascript"),
  v.literal("typescript"),
  v.literal("html"),
  v.literal("css"),
  v.literal("python"),
  v.literal("sql")
);
const locale = v.union(v.literal("en"), v.literal("uk"));

/** Stores a Gemini-generated exercise already validated by `exerciseSchema`. */
export const saveGeneratedExercise = mutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    sessionId: v.optional(v.id("sessions")),
    externalId: v.string(),
    subtopic: v.string(),
    type: exerciseType,
    difficulty: exerciseDifficulty,
    language: programmingLanguage,
    title: v.string(),
    prompt: v.string(),
    starterCode: v.optional(v.string()),
    choices: v.optional(v.array(v.string())),
    testCases: v.optional(
      v.array(
        v.object({
          input: v.string(),
          expectedOutput: v.string(),
          description: v.optional(v.string()),
        })
      )
    ),
    referenceSolution: v.string(),
    // The locale it was actually generated in — see schema.ts's
    // exercises.contentLocale comment. Optional so callers that predate
    // this field (none currently, but keeps the mutation backward
    // compatible) don't need to change.
    contentLocale: v.optional(locale),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("exercises", { ...args, createdAt: Date.now() });
  },
});

/**
 * The Practice board's problem list — exercises generated standalone
 * (no `sessionId`, unlike exercises generated mid-session by the adaptive
 * Learn/Practice-drill flow) so they can be browsed, filtered, and solved
 * independently, LeetCode/Codewars-style. Annotates each with its solve
 * status from `attempts` so the board can show a checkmark without a
 * separate round trip.
 */
export const listPracticeProblems = query({
  args: {
    userId: v.id("users"),
    topicIds: v.optional(v.array(v.id("topics"))),
  },
  handler: async (ctx, args) => {
    const allExercises = await ctx.db
      .query("exercises")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const topicIdSet = args.topicIds ? new Set(args.topicIds) : null;
    const bank = allExercises.filter(
      (e) => e.sessionId === undefined && (!topicIdSet || topicIdSet.has(e.topicId))
    );

    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const statusByExercise = new Map<string, "solved" | "attempted">();
    for (const a of attempts) {
      if (a.result === "correct") {
        statusByExercise.set(a.exerciseId, "solved");
      } else if (!statusByExercise.has(a.exerciseId)) {
        statusByExercise.set(a.exerciseId, "attempted");
      }
    }

    return bank
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((e) => ({
        _id: e._id,
        topicId: e.topicId,
        subtopic: e.subtopic,
        type: e.type,
        difficulty: e.difficulty,
        language: e.language ?? "javascript",
        title: e.title,
        prompt: e.prompt,
        contentLocale: e.contentLocale ?? "en",
        createdAt: e.createdAt,
        status: statusByExercise.get(e._id) ?? "unsolved",
      }));
  },
});

export const getExercise = query({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => ctx.db.get(args.exerciseId),
});

/** Feeds `avoidExerciseTitles` in the exercise-generation prompt so Gemini doesn't repeat itself. */
export const listRecentExerciseTitles = query({
  args: { topicId: v.id("topics"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("exercises")
      .withIndex("by_topic", (q) => q.eq("topicId", args.topicId))
      .order("desc")
      .take(args.limit ?? 10);
    return rows.map((r) => r.title);
  },
});
