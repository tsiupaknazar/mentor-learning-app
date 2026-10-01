import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { analyzeLearningPath, isSandboxTopic } from "./lib/curriculumData";

interface TopicNodeInput {
  id: string;
  title: string;
  summary: string;
  prerequisiteIds: string[];
  children: TopicNodeInput[];
}

// The recursive tree shape is already validated upstream by Zod's
// `learningPathTopicSchema` (lib/schemas.ts) before this mutation is ever
// called — Convex's validator language has no recursive-schema support, so
// we accept it as `v.any()` here rather than partially (and misleadingly)
// re-describing the shape, and rely on the `TopicNodeInput` type below for
// everything downstream of this boundary.
const topicNodeValidator = v.any();

/**
 * Persists a Gemini-generated learning path (already validated against
 * `learningPathSchema` in the API route) by flattening its topic tree into
 * rows. Deactivates any previously active path for this topic so the
 * dashboard always has exactly one "current" path per subject.
 */
export const createLearningPath = mutation({
  args: {
    userId: v.id("users"),
    topic: v.string(),
    title: v.string(),
    rationale: v.string(),
    knowledgeProfileSummary: v.optional(v.string()),
    topics: v.array(topicNodeValidator),
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  },
  handler: async (ctx, args) => {
    const existingActive = await ctx.db
      .query("learningPaths")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    for (const path of existingActive) {
      await ctx.db.patch(path._id, { isActive: false });
    }

    const learningPathId = await ctx.db.insert("learningPaths", {
      userId: args.userId,
      topic: args.topic,
      title: args.title,
      rationale: args.rationale,
      knowledgeProfileSummary: args.knowledgeProfileSummary,
      isActive: true,
      createdAt: Date.now(),
      contentLocale: args.contentLocale ?? "en",
    });

    let orderIndex = 0;
    const insertNode = async (
      node: TopicNodeInput,
      parentTopicId: Id<"topics"> | undefined
    ): Promise<void> => {
      const topicId = await ctx.db.insert("topics", {
        learningPathId,
        userId: args.userId,
        parentTopicId,
        externalId: node.id,
        title: node.title,
        summary: node.summary,
        prerequisiteExternalIds: node.prerequisiteIds,
        orderIndex: orderIndex++,
      });
      await ctx.db.insert("topicProgress", {
        userId: args.userId,
        topicId,
        mastery: {
          knowledge: 0,
          application: 0,
          debugging: 0,
          explanation: 0,
          retention: 0,
          overall: 0,
        },
        attemptsCount: 0,
        status: "not_started",
      });
      for (const child of node.children) {
        await insertNode(child, topicId);
      }
    };

    for (const topLevel of args.topics as TopicNodeInput[]) {
      await insertNode(topLevel, undefined);
    }

    return learningPathId;
  },
});

/** Atomically persists the first path and marks onboarding complete. */
export const createInitialLearningPath = mutation({
  args: {
    userId: v.id("users"),
    topic: v.string(),
    title: v.string(),
    rationale: v.string(),
    knowledgeProfileSummary: v.optional(v.string()),
    topics: v.array(topicNodeValidator),
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
    level: v.union(v.literal("beginner"), v.literal("junior"), v.literal("intermediate"), v.literal("advanced")),
    learningGoal: v.union(v.literal("first_job"), v.literal("interview_prep"), v.literal("improve_skills"), v.literal("learn_new_tech"), v.literal("production_skills"), v.literal("master_topic")),
    learningStyle: v.union(v.literal("more_practice"), v.literal("balanced"), v.literal("more_theory")),
    dailyTime: v.union(v.literal("15min"), v.literal("30min"), v.literal("1hr"), v.literal("2hr_plus")),
    specialty: v.union(v.literal("frontend"), v.literal("backend"), v.literal("mobile"), v.literal("data"), v.literal("general")),
  },
  handler: async (ctx, args) => {
    const existingActive = await ctx.db
      .query("learningPaths")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    for (const path of existingActive) {
      await ctx.db.patch(path._id, { isActive: false });
    }

    const learningPathId = await ctx.db.insert("learningPaths", {
      userId: args.userId,
      topic: args.topic,
      title: args.title,
      rationale: args.rationale,
      knowledgeProfileSummary: args.knowledgeProfileSummary,
      isActive: true,
      createdAt: Date.now(),
      contentLocale: args.contentLocale ?? "en",
    });

    let orderIndex = 0;
    const insertNode = async (
      node: TopicNodeInput,
      parentTopicId: Id<"topics"> | undefined
    ): Promise<void> => {
      const topicId = await ctx.db.insert("topics", {
        learningPathId,
        userId: args.userId,
        parentTopicId,
        externalId: node.id,
        title: node.title,
        summary: node.summary,
        prerequisiteExternalIds: node.prerequisiteIds,
        orderIndex: orderIndex++,
      });
      await ctx.db.insert("topicProgress", {
        userId: args.userId,
        topicId,
        mastery: {
          knowledge: 0,
          application: 0,
          debugging: 0,
          explanation: 0,
          retention: 0,
          overall: 0,
        },
        attemptsCount: 0,
        status: "not_started",
      });
      for (const child of node.children) {
        await insertNode(child, topicId);
      }
    };

    for (const topLevel of args.topics as TopicNodeInput[]) {
      await insertNode(topLevel, undefined);
    }

    await ctx.db.patch(args.userId, {
      level: args.level,
      learningGoal: args.learningGoal,
      learningStyle: args.learningStyle,
      dailyTime: args.dailyTime,
      specialty: args.specialty,
      onboardingComplete: true,
    });

    return learningPathId;
  },
});

/** All of a user's learning paths (active + inactive), most recent first — powers "start a new topic" suggestions (what have they already tried) and a path-history view. */
export const listLearningPaths = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const paths = await ctx.db
      .query("learningPaths")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return paths.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getActiveLearningPath = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const path = await ctx.db
      .query("learningPaths")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!path) return null;

    // `locked` = the learner can't start this topic yet: an earlier topic in
    // the path isn't passed (strict order, beginners) or a prerequisite the AI
    // named isn't. `blockedBy` says which, so the UI can name what to finish
    // first. See convex/lib/curriculum.ts for the rules.
    const { topics, progressByTopic, analysis, strictOrder } = await analyzeLearningPath(ctx, args.userId, path._id);
    const topicsWithLock = topics.map((t) => {
      const a = analysis.get(t._id)!;
      return {
        ...t,
        progress: progressByTopic.get(t._id) ?? null,
        locked: a.block !== null,
        block: a.block,
        blockedBy: a.blockedBy,
        passed: a.passed,
        // A practice sandbox topic, not a step of the path.
        adHoc: isSandboxTopic(t),
      };
    });

    return { path, topics: topicsWithLock, strictOrder };
  },
});

/** Same shape as getActiveLearningPath but by explicit id — used by the translation route, which needs to translate whichever path a page is actually showing, not necessarily the active one. */
export const getLearningPathWithTopics = query({
  args: { learningPathId: v.id("learningPaths") },
  handler: async (ctx, args) => {
    const path = await ctx.db.get(args.learningPathId);
    if (!path) return null;
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_learning_path", (q) => q.eq("learningPathId", path._id))
      .collect();
    return { path, topics };
  },
});

export const getTopic = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    const topic = await ctx.db.get(args.topicId);
    if (!topic) return null;
    const progress = await ctx.db
      .query("topicProgress")
      .withIndex("by_user_and_topic", (q) => q.eq("userId", topic.userId).eq("topicId", topic._id))
      .unique();
    // The learning path's top-level subject (e.g. "JavaScript", "Python") —
    // needed alongside the topic's own title so language inference can fall
    // back to it for language-agnostic subtopic titles like "Loops" or
    // "Recursion" (see lib/topic-language.ts resolveTopicLanguage).
    const learningPath = await ctx.db.get(topic.learningPathId);

    // The immediate parent topic's title (e.g. "Functions" for a
    // "Closures" child node) — gives concept/exercise generation real
    // hierarchy context instead of the topic being generated in isolation.
    // Falls back to the path's own subject for root topics (no parent).
    const parentTopic = topic.parentTopicId ? await ctx.db.get(topic.parentTopicId) : null;

    // The same analysis as getActiveLearningPath's list view, so a learner
    // can't get around a lock by going straight to a topic's URL (or to the
    // Practice page, which used to skip the check entirely).
    const { topics: pathTopics, analysis } = await analyzeLearningPath(ctx, topic.userId, topic.learningPathId);
    const a = analysis.get(topic._id);
    const titleById = new Map(pathTopics.map((t) => [t._id as string, t.title]));

    return {
      topic,
      progress,
      pathTopic: learningPath?.topic ?? null,
      parentTopic: parentTopic ? { title: parentTopic.title } : null,
      locked: a?.block != null,
      block: a?.block ?? null,
      // What to finish first, for the "locked" screen to name and link to.
      blockedBy: (a?.blockedBy ?? []).map((id) => ({ _id: id, title: titleById.get(id) ?? "" })),
    };
  },
});

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}

/**
 * Powers "add a practice topic" on the Practice page: finds a topic by title
 * under the active path, or creates a free-form one to drill in.
 *
 * A title that matches an existing topic of the path returns THAT topic, and
 * the usual rules apply to it - if the learner hasn't reached it yet, it stays
 * blocked (practising ahead of the path used to leak into "what's next").
 * Anything else becomes an ad-hoc topic: a sandbox flagged `adHoc`, which is
 * kept out of the curriculum (never ordered, blocked or recommended, and not
 * counted in path progress) so drilling "CSS Flexbox layouts" on the side can't
 * distort the path. Idempotent by (learning path, slug), so repeated practice
 * reuses one row and its mastery history.
 */
export const findOrCreateAdHocTopic = mutation({
  args: { userId: v.id("users"), title: v.string() },
  handler: async (ctx, args) => {
    const activePath = await ctx.db
      .query("learningPaths")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!activePath) {
      throw new Error("No active learning path — complete onboarding first.");
    }

    const externalId = slugify(args.title);
    const existing = await ctx.db
      .query("topics")
      .withIndex("by_user_and_external_id", (q) => q.eq("userId", args.userId).eq("externalId", externalId))
      .filter((q) => q.eq(q.field("learningPathId"), activePath._id))
      .first();
    if (existing) return existing._id;

    const siblingCount = (
      await ctx.db
        .query("topics")
        .withIndex("by_learning_path", (q) => q.eq("learningPathId", activePath._id))
        .collect()
    ).length;

    const topicId = await ctx.db.insert("topics", {
      learningPathId: activePath._id,
      userId: args.userId,
      parentTopicId: undefined,
      externalId,
      title: args.title,
      summary: `Practice topic: ${args.title}`,
      prerequisiteExternalIds: [],
      orderIndex: siblingCount,
      // A sandbox for free practice - not a step of the learning path.
      adHoc: true,
    });
    await ctx.db.insert("topicProgress", {
      userId: args.userId,
      topicId,
      mastery: { knowledge: 0, application: 0, debugging: 0, explanation: 0, retention: 0, overall: 0 },
      attemptsCount: 0,
      status: "not_started",
    });

    return topicId;
  },
});
