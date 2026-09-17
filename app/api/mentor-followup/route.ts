import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { mentorFollowUpReactionSchema } from "@/lib/schemas";
import { mentorFollowUpReactionGeminiSchema } from "@/lib/gemini-schemas";
import { buildFollowUpReactionPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { getLearnerContext } from "@/lib/learner-context";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const requestSchema = z.object({
  exerciseId: z.string().min(1),
  followUpQuestion: z.string().min(1).max(400),
  learnerResponse: z.string().min(1).max(2000),
});

/**
 * Reacts to a reply to `mentorFollowUp` (see FeedbackPanel) — a single
 * bounded continuation of that one question, not a full chat. Deliberately
 * doesn't touch attempts/scores/mastery: this is the mentor persona's
 * follow-up question actually being answerable, not a new graded attempt.
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

    const learnerContext = await getLearnerContext(user._id);
    const { system, prompt } = buildFollowUpReactionPrompt(
      learnerContext,
      { title: exerciseRow.title, prompt: exerciseRow.prompt },
      body.followUpQuestion,
      body.learnerResponse
    );

    const reaction = await generateStructured({
      schema: mentorFollowUpReactionSchema,
      responseSchema: mentorFollowUpReactionGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });

    return NextResponse.json({ reaction });
  } catch (err) {
    return handleRouteError(err);
  }
}
