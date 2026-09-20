import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClientExercise } from "@/types/domain";
import { ProblemSolver } from "@/components/learning/problem-solver";
import { LockedTopicNotice } from "@/components/learning/locked-topic-notice";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function PracticeProblemPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const user = await requireCurrentUser();
  const exerciseRow = await convexQuery(api.exercises.getExercise, {
    exerciseId: exerciseId as Id<"exercises">,
  });

  if (!exerciseRow || exerciseRow.userId !== user._id) notFound();

  // A problem generated for a topic the learner hasn't reached (an old one, or
  // a bookmarked link) can't be solved: grading it would record progress on
  // material that's still ahead of them.
  const topicData = await convexQuery(api.learningPaths.getTopic, { topicId: exerciseRow.topicId });
  if (topicData?.locked) {
    const t = getDictionary(user.locale ?? "en");
    return (
      <LockedTopicNotice
        topicTitle={topicData.topic.title}
        blockedBy={topicData.blockedBy}
        backHref="/practice"
        backLabel={t.practice.backToBoard}
        note={t.learn.lockedNoticePractice}
      />
    );
  }

  // Strip the answer key server-side — the client only ever sees a
  // ClientExercise, same contract as the generate-on-demand flow.
  const exercise: ClientExercise = {
    id: exerciseRow.externalId,
    topic: exerciseRow.subtopic,
    subtopic: exerciseRow.subtopic,
    type: exerciseRow.type,
    difficulty: exerciseRow.difficulty,
    language: exerciseRow.language ?? "javascript",
    title: exerciseRow.title,
    prompt: exerciseRow.prompt,
    starterCode: exerciseRow.starterCode ?? null,
    choices: exerciseRow.choices ?? null,
    testCases: exerciseRow.testCases
      ? exerciseRow.testCases.map((tc) => ({ ...tc, description: tc.description ?? null }))
      : null,
    previewMarkup: exerciseRow.previewMarkup ?? null,
    contentLocale: exerciseRow.contentLocale ?? "en",
  };

  return <ProblemSolver exerciseId={exerciseRow._id} exercise={exercise} level={user.level} />;
}
