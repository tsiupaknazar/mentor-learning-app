import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { exerciseSchema } from "@/lib/schemas";
import { exerciseGeminiSchema } from "@/lib/gemini-schemas";
import { buildExercisePrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { getLearnerContext } from "@/lib/learner-context";
import { pickDifficulty } from "@/lib/difficulty";
import { pickScaffolding } from "@/lib/scaffolding";
import { resolveTopicLanguage } from "@/lib/topic-language";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const requestSchema = z.object({
  topicId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  challengeMode: z.boolean().default(false),
});

/**
 * Generates one exercise for a topic. Difficulty is resolved server-side
 * from measured mastery (never trusted from the client), and the reference
 * solution is stripped before the response is sent to the browser — the
 * grader (app/api/evaluate) reads it back out of Convex, not from the client.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const topicId = body.topicId as Id<"topics">;

    const topicData = await convexQuery(api.learningPaths.getTopic, { topicId });
    if (!topicData || topicData.topic.userId !== user._id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // Defense in depth against the prerequisite lock — the topic page
    // already refuses to render a session for a locked topic, but a
    // learner could still hit this endpoint directly.
    if (topicData.locked) {
      return NextResponse.json({ error: "topic_locked" }, { status: 403 });
    }

    const difficulty = pickDifficulty(
      topicData.progress?.mastery.overall ?? 0,
      topicData.progress?.attemptsCount ?? 0,
      body.challengeMode,
      user.level
    );

    const recentTitles = await convexQuery(api.exercises.listRecentExerciseTitles, {
      topicId,
      limit: 8,
    });

    const learnerContext = await getLearnerContext(user._id);
    const requiredLanguage = resolveTopicLanguage(topicData.topic.title, topicData.pathTopic);
    // Real hierarchy context instead of passing the same title twice: the
    // immediate parent topic (e.g. "Functions" for a "Closures" child), or
    // the path's own subject for a root topic with no parent.
    const topicLabel = topicData.parentTopic?.title ?? topicData.pathTopic ?? topicData.topic.title;
    const { system, prompt } = buildExercisePrompt(
      learnerContext,
      topicLabel,
      topicData.topic.title,
      difficulty,
      recentTitles,
      requiredLanguage,
      pickScaffolding(learnerContext.level, topicData.progress?.attemptsCount ?? 0, body.challengeMode)
    );

    const exercise = await generateStructured({
      schema: exerciseSchema,
      responseSchema: exerciseGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });
    // Deterministic override — never trust the model's own choice for a
    // topic that unambiguously names a language.
    if (requiredLanguage) exercise.language = requiredLanguage;

    const exerciseId = await convexMutation(api.exercises.saveGeneratedExercise, {
      userId: user._id,
      topicId,
      sessionId: body.sessionId ? (body.sessionId as Id<"sessions">) : undefined,
      externalId: exercise.id,
      subtopic: exercise.subtopic,
      type: exercise.type,
      difficulty: exercise.difficulty,
      language: exercise.language,
      title: exercise.title,
      prompt: exercise.prompt,
      contentLocale: learnerContext.locale,
      starterCode: exercise.starterCode ?? undefined,
      choices: exercise.choices ?? undefined,
      testCases: exercise.testCases
        ? exercise.testCases.map((tc) => ({ ...tc, description: tc.description ?? undefined }))
        : undefined,
      referenceSolution: exercise.referenceSolution,
      previewMarkup: exercise.previewMarkup ?? undefined,
    });

    // Strip the answer key before it ever reaches the browser.
    const { referenceSolution: _omit, ...clientSafeExercise } = exercise;
    return NextResponse.json({ exerciseId, exercise: clientSafeExercise });
  } catch (err) {
    return handleRouteError(err);
  }
}
