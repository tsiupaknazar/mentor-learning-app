import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { hintSchema } from "@/lib/schemas";
import { hintGeminiSchema } from "@/lib/gemini-schemas";
import { buildHintPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Exercise } from "@/lib/schemas";

const requestSchema = z.object({
  exerciseId: z.string().min(1),
  hintLevel: z.enum(["direction", "specific_problem", "strong_hint"]),
  learnerAttemptSoFar: z.string().max(8000).nullable(),
});

/** Progressive hint system (spec section 11) — never reveals the full solution. */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const exerciseId = body.exerciseId as Id<"exercises">;

    const exerciseRow = await convexQuery(api.exercises.getExercise, { exerciseId });
    if (!exerciseRow || exerciseRow.userId !== user._id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

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

    const { system, prompt } = buildHintPrompt(
      exercise,
      body.hintLevel,
      body.learnerAttemptSoFar,
      user.locale ?? "en"
    );
    const hint = await generateStructured({
      schema: hintSchema,
      responseSchema: hintGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });

    return NextResponse.json({ hint });
  } catch (err) {
    return handleRouteError(err);
  }
}
