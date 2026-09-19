import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SessionRunner } from "@/components/learning/session-runner";
import { LockedTopicNotice } from "@/components/learning/locked-topic-notice";

export default async function TopicSessionPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const user = await requireCurrentUser();
  const data = await convexQuery(api.learningPaths.getTopic, { topicId: topicId as Id<"topics"> });

  if (!data || data.topic.userId !== user._id) notFound();

  // Blocks starting a session for a topic whose prerequisites aren't
  // mastered yet — mirrors the lock shown in the Learn tab's topic list
  // (LearnPathView), but also covers direct URL navigation around it.
  if (data.locked) {
    return <LockedTopicNotice topicTitle={data.topic.title} />;
  }

  return (
    <SessionRunner
      userId={user._id}
      topicId={data.topic._id}
      topicTitle={data.topic.title}
      topicSummary={data.topic.summary}
      masteryOverall={data.progress?.mastery.overall ?? 0}
      dailyTime={user.dailyTime}
      topicContextLabel={data.parentTopic?.title ?? data.pathTopic ?? undefined}
    />
  );
}
