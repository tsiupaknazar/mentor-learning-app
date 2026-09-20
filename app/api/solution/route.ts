import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const requestSchema = z.object({ exerciseId: z.string().min(1) });

/**
 * The worked solution, for a learner who has tried and is still stuck. Hints
 * stop short of the answer by design, which left a beginner with nowhere to go
 * after the third one; this is the way out - but only after a real attempt
 * that wasn't correct, so it can't replace trying. Showing it is recorded on
 * the exercise, and every later attempt counts as having seen the answer.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const exerciseId = body.exerciseId as Id<"exercises">;

    const exercise = await convexQuery(api.exercises.getExercise, { exerciseId });
    if (!exercise || exercise.userId !== user._id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const topicData = await convexQuery(api.learningPaths.getTopic, { topicId: exercise.topicId });
    if (topicData?.locked) {
      return NextResponse.json({ error: "topic_locked" }, { status: 403 });
    }

    const attempts = await convexQuery(api.attempts.listAttemptsForExercise, { exerciseId });
    if (!attempts.some((a) => a.result !== "correct")) {
      return NextResponse.json({ error: "solution_unavailable" }, { status: 403 });
    }

    await convexMutation(api.exercises.markSolutionRevealed, { exerciseId });
    return NextResponse.json({ solution: exercise.referenceSolution });
  } catch (err) {
    return handleRouteError(err);
  }
}
