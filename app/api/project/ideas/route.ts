import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { projectIdeasSchema, skillLevelSchema } from "@/lib/schemas";
import { projectIdeasGeminiSchema } from "@/lib/gemini-schemas";
import { buildProjectIdeasPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { getLearnerContext } from "@/lib/learner-context";
import { handleRouteError } from "@/lib/route-utils";

const requestSchema = z.object({
  level: skillLevelSchema,
});

/**
 * Generates a handful of project idea "pitches" (title + short description)
 * grounded in the learner's current path — spec section 14. Deliberately
 * lighter than POST /api/project (no files/tasks, "fast" tier) since this is
 * just browsing options; picking one re-uses the existing full-plan route
 * with idea.topic as the seed, same as a hand-typed topic.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());

    const learnerContext = await getLearnerContext(user._id).catch(() => ({
      level: user.level,
      learningGoal: user.learningGoal,
      learningStyle: user.learningStyle,
      dailyTime: user.dailyTime,
      specialty: user.specialty ?? "general",
      locale: user.locale ?? "en",
      currentTopics: [],
      weakTopics: [],
      strongTopics: [],
      recurringMistakes: [],
      recentPerformance: 0,
      pathSubject: null,
    }));

    const { system, prompt } = buildProjectIdeasPrompt(learnerContext, body.level);
    const { ideas } = await generateStructured({
      schema: projectIdeasSchema,
      responseSchema: projectIdeasGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });

    return NextResponse.json({ ideas });
  } catch (err) {
    return handleRouteError(err);
  }
}
