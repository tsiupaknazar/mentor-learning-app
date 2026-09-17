import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClientExercise } from "@/types/domain";
import { ProblemSolver } from "@/components/learning/problem-solver";

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
    contentLocale: exerciseRow.contentLocale ?? "en",
  };

  return <ProblemSolver exerciseId={exerciseRow._id} exercise={exercise} />;
}
