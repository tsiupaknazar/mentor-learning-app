import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SessionRunner } from "@/components/learning/session-runner";

/**
 * Practice's own session page — deliberately separate from
 * /learn/[topicId]. It reuses the same topic data and the same
 * SessionRunner (so exercise generation, hints, and AI evaluation stay
 * identical), but runs it in "practice" mode: no concept/lesson step,
 * straight into generating coding exercises for the chosen topic.
 */
export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const user = await requireCurrentUser();
  const data = await convexQuery(api.learningPaths.getTopic, { topicId: topicId as Id<"topics"> });

  if (!data || data.topic.userId !== user._id) notFound();

  return (
    <SessionRunner
      mode="practice"
      userId={user._id}
      topicId={data.topic._id}
      topicTitle={data.topic.title}
      topicSummary={data.topic.summary}
      masteryOverall={data.progress?.mastery.overall ?? 0}
      backHref="/practice"
    />
  );
}
