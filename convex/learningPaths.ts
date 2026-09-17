import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { isTopicLocked } from "./lib/topicLocking";

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

    const topics = await ctx.db
      .query("topics")
      .withIndex("by_learning_path", (q) => q.eq("learningPathId", path._id))
      .collect();

    const progressByTopic = await Promise.all(
      topics.map((t) =>
        ctx.db
          .query("topicProgress")
          .withIndex("by_user_and_topic", (q) => q.eq("userId", args.userId).eq("topicId", t._id))
          .unique()
      )
    );

    const topicsWithProgress = topics.map((t, i) => ({
      ...t,
      progress: progressByTopic[i] ?? null,
    }));

    // Locked = not yet unlocked for the learner to start, based on
    // whether its prerequisite topics (by externalId, within this same
    // path) are mastered yet. See convex/lib/topicLocking.ts.
    const statusByExternalId = new Map(topicsWithProgress.map((t) => [t.externalId, t.progress?.status]));
    const topicsWithLock = topicsWithProgress.map((t) => ({
      ...t,
      locked: isTopicLocked(t.prerequisiteExternalIds, statusByExternalId),
    }));

    return { path, topics: topicsWithLock };
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

    // Same prerequisite check as getActiveLearningPath's list view, so a
    // learner can't bypass the lock by navigating straight to the URL of a
    // topic they haven't unlocked yet.
    let locked = false;
    if (topic.prerequisiteExternalIds.length > 0) {
      const siblingTopics = await ctx.db
        .query("topics")
        .withIndex("by_learning_path", (q) => q.eq("learningPathId", topic.learningPathId))
        .collect();
      const siblingProgress = await Promise.all(
        siblingTopics.map((t) =>
          ctx.db
            .query("topicProgress")
            .withIndex("by_user_and_topic", (q) => q.eq("userId", topic.userId).eq("topicId", t._id))
            .unique()
        )
      );
      const statusByExternalId = new Map(siblingTopics.map((t, i) => [t.externalId, siblingProgress[i]?.status]));
      locked = isTopicLocked(topic.prerequisiteExternalIds, statusByExternalId);
    }

    return {
      topic,
      progress,
      pathTopic: learningPath?.topic ?? null,
      parentTopic: parentTopic ? { title: parentTopic.title } : null,
      locked,
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
 * Powers the Practice page: finds or creates a topic by title under the
 * user's active learning path, without requiring the user to navigate the
 * structured tree first. This is what makes "Practice" genuinely different
 * from "Learn" — Learn browses the AI-generated curriculum tree in order;
 * Practice lets you jump straight into any topic/language you want to
 * drill (including ones the structured path hasn't reached yet, or a
 * custom one like "CSS Flexbox layouts") and reuses the exact same session
 * flow once the topic exists. Idempotent by (learning path, slug) so
 * repeated practice on the same topic reuses one row and its mastery
 * history, rather than fragmenting progress across duplicates.
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
