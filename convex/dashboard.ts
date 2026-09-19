import { query } from "./_generated/server";
import { v } from "convex/values";
import { masteryBand } from "./lib/bands";
import { isTopicLocked } from "./lib/topicLocking";
import { orderTopicsForLearning } from "./lib/topicOrder";

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

    const progressRows = await ctx.db
      .query("topicProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const topics = activePath
      ? await ctx.db
          .query("topics")
          .withIndex("by_learning_path", (q) => q.eq("learningPathId", activePath._id))
          .collect()
      : [];
    const titleByTopicId = new Map(topics.map((t) => [t._id, t]));

    // Progress rows outlive their path (starting a new topic deactivates the old
    // path but keeps its rows), so everything below - the next action AND the
    // counts - only considers topics of the active path. Otherwise an old path's
    // topic could win the lookup and leave the dashboard with no next action.
    const pathProgress = progressRows.filter((p) => titleByTopicId.has(p.topicId));

    // A topic can't be started (or continued) while a prerequisite isn't
    // mastered, so it's never a valid suggestion - the button would just lead
    // to the "locked" notice. Same rule as the Learn tab (convex/lib/topicLocking.ts).
    const statusByExternalId = new Map(
      topics.map((t) => [t.externalId, pathProgress.find((p) => p.topicId === t._id)?.status])
    );
    const isLocked = (topicId: string) => {
      const topic = titleByTopicId.get(topicId as never);
      return !topic || isTopicLocked(topic.prerequisiteExternalIds, statusByExternalId);
    };

    // Next action: prefer a topic due for spaced-repetition review, then an
    // in-progress topic with the lowest mastery, then the first not-started
    // topic in learning-path order.
    const now = Date.now();
    const dueList = pathProgress
      .filter((p) => p.nextReviewDue !== undefined && p.nextReviewDue <= now && p.status !== "mastered" && !isLocked(p.topicId))
      .sort((a, b) => (a.nextReviewDue ?? 0) - (b.nextReviewDue ?? 0));
    const dueForReview = dueList[0];

    const inProgress = pathProgress
      .filter((p) => (p.status === "in_progress" || p.status === "needs_review") && !isLocked(p.topicId))
      .sort((a, b) => a.mastery.overall - b.mastery.overall)[0];

    const notStarted = orderTopicsForLearning(topics)
      .map((t) => ({ topic: t, progress: pathProgress.find((p) => p.topicId === t._id) }))
      .find((x) => (!x.progress || x.progress.status === "not_started") && !isLocked(x.topic._id));

    let nextAction:
      | { kind: "review" | "continue" | "start"; topicId: string; topicTitle: string; mastery: number }
      | null = null;

    if (dueForReview) {
      const t = titleByTopicId.get(dueForReview.topicId);
      if (t) nextAction = { kind: "review", topicId: t._id, topicTitle: t.title, mastery: dueForReview.mastery.overall };
    } else if (inProgress) {
      const t = titleByTopicId.get(inProgress.topicId);
      if (t) nextAction = { kind: "continue", topicId: t._id, topicTitle: t.title, mastery: inProgress.mastery.overall };
    } else if (notStarted) {
      nextAction = {
        kind: "start",
        topicId: notStarted.topic._id,
        topicTitle: notStarted.topic.title,
        mastery: 0,
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
      topicsCount: topics.length,
      topicsMastered: pathProgress.filter((p) => p.status === "mastered").length,
      openMistakesCount: openMistakesCount.length,
      // Topics due for spaced-repetition review (same rules as the pick above),
      // so the dashboard can say how many are waiting, not just the first.
      reviewsDue: dueList.length,
      nextAction,
    };
  },
});
