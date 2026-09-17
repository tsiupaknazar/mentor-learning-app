import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { learningPathSchema, knowledgeProfileSchema } from "@/lib/schemas";
import { learningPathGeminiSchema } from "@/lib/gemini-schemas";
import { buildLearningPathPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation } from "@/lib/convex-server";
import { getLearnerContext } from "@/lib/learner-context";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";

const requestSchema = z.object({
  topic: z.string().min(1).max(120),
  knowledgeProfile: knowledgeProfileSchema.nullable(),
});

/**
 * Generates a learning path with Gemini, then persists it via Convex. The
 * generation and the persistence are two separate steps on purpose: if
 * Convex validation ever disagrees with the Zod schema, we fail loudly
 * instead of writing partial data.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());

    // First learning path for a brand-new user has no prior context to draw on yet.
    const ctx = user.onboardingComplete
      ? await getLearnerContext(user._id).catch(() => null)
      : null;
    const learnerContext = ctx ?? {
      level: user.level,
      learningGoal: user.learningGoal,
      learningStyle: user.learningStyle,
      locale: user.locale ?? "en",
      currentTopics: [],
      weakTopics: [],
      strongTopics: [],
      recurringMistakes: [],
      recentPerformance: 0,
      pathSubject: null,
    };

    const { system, prompt } = buildLearningPathPrompt(learnerContext, body.topic, body.knowledgeProfile);
    const path = await generateStructured({
      schema: learningPathSchema,
      responseSchema: learningPathGeminiSchema,
      system,
      prompt,
      tier: "reasoning",
    });

    const learningPathId = await convexMutation(api.learningPaths.createLearningPath, {
      userId: user._id,
      topic: body.topic,
      title: path.title,
      rationale: path.rationale,
      knowledgeProfileSummary: body.knowledgeProfile?.summary,
      topics: path.topics,
      contentLocale: user.locale ?? "en",
    });

    return NextResponse.json({ learningPathId, path });
  } catch (err) {
    return handleRouteError(err);
  }
}
