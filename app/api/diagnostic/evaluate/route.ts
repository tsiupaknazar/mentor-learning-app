import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { knowledgeProfileSchema, DIAGNOSTIC_QUESTION_COUNT } from "@/lib/schemas";
import { knowledgeProfileGeminiSchema } from "@/lib/gemini-schemas";
import { buildKnowledgeProfilePrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { handleRouteError } from "@/lib/route-utils";

const requestSchema = z.object({
  topic: z.string().min(1).max(120),
  // Bounded by DIAGNOSTIC_QUESTION_COUNT, NOT a smaller hand-picked number —
  // the client submits one answer per generated question (see
  // diagnosticSetSchema), and generation can go up to that max for broad
  // topics. A stricter cap here silently 400s real submissions.
  answers: z
    .array(
      z.object({
        prompt: z.string().min(1),
        type: z.string().min(1),
        subtopic: z.string().min(1),
        answer: z.string().max(4000),
      })
    )
    .min(1)
    .max(DIAGNOSTIC_QUESTION_COUNT.max),
});

/** Evaluates a completed diagnostic and returns a per-subtopic knowledge profile (spec section 4). */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());

    const { system, prompt } = buildKnowledgeProfilePrompt(body.topic, body.answers, user.locale ?? "en");
    const profile = await generateStructured({
      schema: knowledgeProfileSchema,
      responseSchema: knowledgeProfileGeminiSchema,
      system,
      prompt,
      tier: "reasoning",
    });

    return NextResponse.json({ profile });
  } catch (err) {
    return handleRouteError(err);
  }
}
