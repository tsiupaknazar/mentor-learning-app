import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { analyzeCurriculum, isAdHocTopic, usesStrictOrder, type TopicAnalysis, type TopicFacts } from "./curriculum";

/**
 * Loads what convex/lib/curriculum.ts needs for one learning path and runs
 * it, so every query that reports on the path (the Learn tree, a single
 * topic, the dashboard) works from the same facts and gets the same answer.
 */
export async function analyzeLearningPath(ctx: QueryCtx, userId: Id<"users">, learningPathId: Id<"learningPaths">) {
  const user = await ctx.db.get(userId);
  const topics = await ctx.db
    .query("topics")
    .withIndex("by_learning_path", (q) => q.eq("learningPathId", learningPathId))
    .collect();
  const topicIds = new Set<string>(topics.map((t) => t._id));

  const progressRows = (
    await ctx.db
      .query("topicProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  ).filter((p) => topicIds.has(p.topicId));
  const progressByTopic = new Map(progressRows.map((p) => [p.topicId as string, p]));

  // A completed Learn session is what "having learned" a topic means.
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const learnedTopicIds = new Set<string>(
    sessions.filter((s) => s.completedAt !== undefined && s.mode !== "practice").map((s) => s.topicId)
  );

  const facts = new Map<string, TopicFacts>(
    topics.map((t) => [t._id, { status: progressByTopic.get(t._id)?.status, learned: learnedTopicIds.has(t._id) }])
  );
  const strictOrder = usesStrictOrder(user?.level);
  const analysis: Map<string, TopicAnalysis> = analyzeCurriculum(topics, facts, { strictOrder });

  return { topics, progressByTopic, learnedTopicIds, analysis, strictOrder };
}

export type PathAnalysis = Awaited<ReturnType<typeof analyzeLearningPath>>;
export type TopicDoc = Doc<"topics">;

/** True for a practice-sandbox topic (flagged, or created before the flag existed). */
export const isSandboxTopic = (topic: TopicDoc) => isAdHocTopic(topic);
