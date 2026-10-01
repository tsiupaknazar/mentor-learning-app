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
  onboarding: z.object({
    level: z.enum(["beginner", "junior", "intermediate", "advanced"]),
    learningGoal: z.enum(["first_job", "interview_prep", "improve_skills", "learn_new_tech", "production_skills", "master_topic"]),
    learningStyle: z.enum(["more_practice", "balanced", "more_theory"]),
    dailyTime: z.enum(["15min", "30min", "1hr", "2hr_plus"]),
    specialty: z.enum(["frontend", "backend", "mobile", "data", "general"]),
  }).optional(),
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

    // A fresh diagnostic is the strongest signal for the initial path. Merge
    // it into historical context so prompt guidance cannot claim there are
    // "no weak areas" while the diagnostic says otherwise.
    const diagnosticWeakTopics =
      body.knowledgeProfile?.subtopics.filter((s) => s.band === "weak").map((s) => s.subtopic) ?? [];
    const diagnosticStrongTopics =
      body.knowledgeProfile?.subtopics.filter((s) => s.band === "strong").map((s) => s.subtopic) ?? [];
    const effectiveLearnerContext = {
      ...learnerContext,
      weakTopics: [...new Set([...learnerContext.weakTopics, ...diagnosticWeakTopics])],
      strongTopics: [...new Set([...learnerContext.strongTopics, ...diagnosticStrongTopics])],
    };

    const { system, prompt } = buildLearningPathPrompt(effectiveLearnerContext, body.topic, body.knowledgeProfile);
    const path = await generateStructured({
      schema: learningPathSchema,
      responseSchema: learningPathGeminiSchema,
      system,
      prompt,
      tier: "reasoning",
    });

    const pathArgs = {
      userId: user._id,
      topic: body.topic,
      title: path.title,
      rationale: path.rationale,
      knowledgeProfileSummary: body.knowledgeProfile?.summary,
      topics: path.topics,
      contentLocale: user.locale ?? "en",
    };

    const learningPathId =
      !user.onboardingComplete && body.onboarding
        ? await convexMutation(api.learningPaths.createInitialLearningPath, {
            ...pathArgs,
            ...body.onboarding,
          })
        : await convexMutation(api.learningPaths.createLearningPath, pathArgs);

    return NextResponse.json({ learningPathId, path });
  } catch (err) {
    return handleRouteError(err);
  }
}
