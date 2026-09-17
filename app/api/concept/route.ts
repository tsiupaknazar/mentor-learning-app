import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { conceptSchema } from "@/lib/schemas";
import { conceptGeminiSchema } from "@/lib/gemini-schemas";
import { buildConceptPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { getLearnerContext } from "@/lib/learner-context";
import { handleRouteError } from "@/lib/route-utils";

const requestSchema = z.object({
  topic: z.string().min(1).max(120),
  subtopic: z.string().min(1).max(120),
});

/**
 * The "Quick concept" + "Example" steps from spec section 6. Deliberately
 * NOT persisted to Convex — this is supplementary teaching content, not a
 * graded artifact, and it's cheap enough (fast tier, short output) to just
 * regenerate on request. If cost ever becomes a concern, cache by
 * (topic, subtopic, level) in Convex before reaching for a bigger change.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());

    const learnerContext = await getLearnerContext(user._id).catch(() => ({
      level: user.level,
      learningGoal: user.learningGoal,
      learningStyle: user.learningStyle,
      locale: user.locale ?? "en",
      currentTopics: [],
      weakTopics: [],
      strongTopics: [],
      recurringMistakes: [],
      recentPerformance: 0,
    }));

    const { system, prompt } = buildConceptPrompt(learnerContext, body.topic, body.subtopic);
    const concept = await generateStructured({
      schema: conceptSchema,
      responseSchema: conceptGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });

    return NextResponse.json({ concept });
  } catch (err) {
    return handleRouteError(err);
  }
}
