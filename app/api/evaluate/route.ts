import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { evaluationSchema } from "@/lib/schemas";
import { evaluationGeminiSchema } from "@/lib/gemini-schemas";
import { buildEvaluationPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { getLearnerContext } from "@/lib/learner-context";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Exercise } from "@/lib/schemas";
import type { AttemptReward } from "@/types/domain";

const requestSchema = z.object({
  exerciseId: z.string().min(1),
  submittedAnswer: z.string().min(1).max(8000),
  hintsUsed: z.number().int().min(0).max(3),
  solutionRevealed: z.boolean(),
  sessionId: z.string().min(1).nullable(),
});

/**
 * The heart of the AI code review loop (spec sections 9, 10, 27). Fetches
 * the reference solution server-side (never trusts the client for it),
 * asks Gemini for a structured, mentor-voiced evaluation, then records the
 * attempt — which is what actually updates mastery, mistakes, and XP.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const exerciseId = body.exerciseId as Id<"exercises">;

    const exerciseRow = await convexQuery(api.exercises.getExercise, { exerciseId });
    if (!exerciseRow || exerciseRow.userId !== user._id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Grading records progress, so it must not be possible for a topic the
    // learner hasn't reached - an old practice problem, a hand-built request.
    const topicData = await convexQuery(api.learningPaths.getTopic, { topicId: exerciseRow.topicId });
    if (topicData?.locked) {
      return NextResponse.json({ error: "topic_locked" }, { status: 403 });
    }

    const exercise: Exercise = {
      id: exerciseRow.externalId,
      topic: exerciseRow.subtopic,
      subtopic: exerciseRow.subtopic,
      type: exerciseRow.type,
      difficulty: exerciseRow.difficulty,
      language: exerciseRow.language ?? "javascript", // pre-migration rows predate this field
      title: exerciseRow.title,
      prompt: exerciseRow.prompt,
      starterCode: exerciseRow.starterCode ?? null,
      choices: exerciseRow.choices ?? null,
      testCases: exerciseRow.testCases
        ? exerciseRow.testCases.map((tc) => ({ ...tc, description: tc.description ?? null }))
        : null,
      referenceSolution: exerciseRow.referenceSolution,
    };

    const learnerContext = await getLearnerContext(user._id);
    const { system, prompt } = buildEvaluationPrompt(learnerContext, exercise, body.submittedAnswer);

    const evaluation = await generateStructured({
      schema: evaluationSchema,
      responseSchema: evaluationGeminiSchema,
      system,
      prompt,
      tier: "reasoning",
    });

    const attempt = await convexMutation(api.attempts.recordAttempt, {
      userId: user._id,
      exerciseId,
      topicId: exerciseRow.topicId,
      submittedAnswer: body.submittedAnswer,
      hintsUsed: body.hintsUsed,
      solutionRevealed: body.solutionRevealed,
      result: evaluation.result === "partially_correct" ? "partially_correct" : evaluation.result,
      scores: evaluation.scores,
      feedback: {
        whatYouDid: evaluation.whatYouDid,
        problem: evaluation.problem ?? undefined,
        whyItMatters: evaluation.whyItMatters ?? undefined,
        hint: evaluation.hint ?? undefined,
        nextStep: evaluation.nextStep,
        detectedMisconception: evaluation.detectedMisconception ?? undefined,
        detectedMisconceptionKey: evaluation.detectedMisconceptionKey ?? undefined,
        mentorFollowUp: evaluation.mentorFollowUp ?? undefined,
      },
      exerciseType: exerciseRow.type,
      contentLocale: user.locale ?? "en",
    });

    const streakAchievements = await convexMutation(api.users.recordActivity, { userId: user._id });
    if (body.sessionId) {
      await convexMutation(api.sessions.incrementSessionProgress, {
        sessionId: body.sessionId as Id<"sessions">,
        // So a revised resubmission of the same exercise isn't counted twice.
        exerciseId,
      });
    }

    // Convex and Next.js deploy separately, so for a moment this can run
    // against a backend that predates the reward fields - degrade to "nothing
    // earned" (the strip hides itself) rather than showing NaN.
    const reward: AttemptReward = {
      xpAwarded: attempt.xpAwarded ?? 0,
      masteryBefore: attempt.masteryBefore ?? attempt.mastery.overall,
      masteryAfter: attempt.mastery.overall,
      newAchievements: [...(attempt.newAchievements ?? []), ...(streakAchievements ?? [])],
    };

    return NextResponse.json({ evaluation, mastery: attempt.mastery, reward });
  } catch (err) {
    return handleRouteError(err);
  }
}
