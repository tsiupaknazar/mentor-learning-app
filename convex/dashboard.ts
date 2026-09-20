import { query } from "./_generated/server";
import { v } from "convex/values";
import { masteryBand } from "./lib/bands";
import { findNextTopic } from "./lib/curriculum";
import { analyzeLearningPath, isSandboxTopic } from "./lib/curriculumData";

/**
 * Builds the compact `LearnerContext` (types/domain.ts) that every Gemini
 * call is grounded in. Deliberately returns only weak/strong topic titles
 * and recurring mistake descriptions — never full attempt history — per
 * the cost-control rule in spec section 31.
 */
export const getLearnerContext = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const activePath = await ctx.db
      .query("learningPaths")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    const topics = activePath
      ? await ctx.db
          .query("topics")
          .withIndex("by_learning_path", (q) => q.eq("learningPathId", activePath._id))
          .collect()
      : [];

    const progressRows = await ctx.db
      .query("topicProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const progressByTopicId = new Map(progressRows.map((p) => [p.topicId, p]));
    const titleById = new Map(topics.map((t) => [t._id, t.title]));

    const weakTopics: string[] = [];
    const strongTopics: string[] = [];
    const currentTopics: string[] = [];
    let scoredCount = 0;
    let scoreSum = 0;

    for (const t of topics) {
      const progress = progressByTopicId.get(t._id);
      if (!progress || progress.attemptsCount === 0) continue;
      const band = masteryBand(progress.mastery.overall);
      if (band === "weak") weakTopics.push(t.title);
      if (band === "strong") strongTopics.push(t.title);
      if (progress.status === "in_progress" || progress.status === "needs_review") {
        currentTopics.push(t.title);
      }
      scoredCount += 1;
      scoreSum += progress.mastery.overall;
    }

    const openMistakes = await ctx.db
      .query("mistakes")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "needs_review"))
      .collect();

    return {
      level: user.level,
      learningGoal: user.learningGoal,
      learningStyle: user.learningStyle,
      locale: user.locale ?? "en",
      currentTopics: currentTopics.slice(0, 5),
      weakTopics: weakTopics.slice(0, 5),
      strongTopics: strongTopics.slice(0, 5),
      recurringMistakes: openMistakes.map((m) => m.description).slice(0, 5),
      recentPerformance: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0,
      titleById: Object.fromEntries(titleById),
      // The active learning path's own top-level subject (e.g. "HTML/CSS"),
      // as opposed to `currentTopics` which are individual subtopic titles
      // within it — this is the deterministic anchor project generation
      // uses to keep scope honest even when a project idea's own free-text
      // label doesn't restate it. See lib/topic-language.ts's
      // resolveProjectLanguageScope for why this matters.
      pathSubject: activePath?.topic ?? null,
    };
  },
});

/** Powers the "what should I do right now" dashboard card (spec section 24). */
export const getDashboardSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const activePath = await ctx.db
      .query("learningPaths")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    // Everything here is about the CURRENT path's steps. Progress rows outlive
    // their path (a new path deactivates the old one but keeps its rows), and
    // free-form practice topics are a sandbox, not steps - neither may win the
    // "what's next" lookup or inflate the counts.
    const analyzed = activePath ? await analyzeLearningPath(ctx, args.userId, activePath._id) : null;
    const curriculum = (analyzed?.topics ?? []).filter((t) => !isSandboxTopic(t));
    const analysis = analyzed?.analysis ?? new Map();
    const progressOf = (topicId: string) => analyzed?.progressByTopic.get(topicId);
    const pathProgress = curriculum.flatMap((t) => progressOf(t._id) ?? []);

    // What's next is decided by the PATH, not by where the learner has been
    // drilling: the first topic in path order that isn't passed (mastered, or
    // a Learn session finished on it). A Practice attempt on a later topic
    // leaves that unchanged - it used to make the dashboard say "continue
    // Flexbox" before the learner had opened the first topic. That topic is
    // never blocked (everything before it is passed), so there's always a
    // valid step. Spaced-repetition reviews still come first, but only for
    // topics the learner has actually learned.
    const now = Date.now();
    const dueList = curriculum
      .filter((t) => {
        const progress = progressOf(t._id);
        const a = analysis.get(t._id);
        return (
          a?.passed === true &&
          a.block === null &&
          progress?.status !== "mastered" &&
          progress?.nextReviewDue !== undefined &&
          progress.nextReviewDue <= now
        );
      })
      .sort((a, b) => (progressOf(a._id)?.nextReviewDue ?? 0) - (progressOf(b._id)?.nextReviewDue ?? 0));
    const dueForReview = dueList[0];
    const frontier = findNextTopic(curriculum, analysis);

    let nextAction:
      | { kind: "review" | "continue" | "start"; topicId: string; topicTitle: string; mastery: number }
      | null = null;

    if (dueForReview) {
      nextAction = {
        kind: "review",
        topicId: dueForReview._id,
        topicTitle: dueForReview.title,
        mastery: progressOf(dueForReview._id)?.mastery.overall ?? 0,
      };
    } else if (frontier) {
      const progress = progressOf(frontier._id);
      nextAction = {
        kind: (progress?.attemptsCount ?? 0) > 0 ? "continue" : "start",
        topicId: frontier._id,
        topicTitle: frontier.title,
        mastery: progress?.mastery.overall ?? 0,
      };
    }

    const overallMastery =
      pathProgress.length > 0
        ? Math.round(pathProgress.reduce((sum, p) => sum + p.mastery.overall, 0) / pathProgress.length)
        : 0;

    const openMistakesCount = await ctx.db
      .query("mistakes")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "needs_review"))
      .collect();

    return {
      user: {
        displayName: user.displayName,
        level: user.level,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalXp: user.totalXp,
      },
      activePathTitle: activePath?.title ?? null,
      overallMastery,
      topicsCount: curriculum.length,
      topicsMastered: pathProgress.filter((p) => p.status === "mastered").length,
      // Every step of the path is passed - nothing left to recommend.
      pathComplete: curriculum.length > 0 && frontier === null,
      openMistakesCount: openMistakesCount.length,
      // Topics due for spaced-repetition review (same rules as the pick above),
      // so the dashboard can say how many are waiting, not just the first.
      reviewsDue: dueList.length,
      nextAction,
    };
  },
});
