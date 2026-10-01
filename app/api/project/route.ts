import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { projectPlanSchema, skillLevelSchema } from "@/lib/schemas";
import { projectPlanGeminiSchema } from "@/lib/gemini-schemas";
import { buildProjectPlanPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation } from "@/lib/convex-server";
import { getLearnerContext } from "@/lib/learner-context";
import { resolveProjectLanguageScope } from "@/lib/topic-language";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";

const requestSchema = z.object({
  topic: z.string().min(1).max(120),
  level: skillLevelSchema,
});

/**
 * Generates a Team-Lead-style project (title, description, ordered tasks
 * with reviewable requirements) and persists it — spec section 14. Level
 * is decided by the caller (defaults to the learner's own level in the UI),
 * never by Gemini, same reasoning as exercise difficulty in lib/difficulty.ts.
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

    const { system, prompt } = buildProjectPlanPrompt(learnerContext, body.topic, body.level);
    let plan = await generateStructured({
      schema: projectPlanSchema,
      responseSchema: projectPlanGeminiSchema,
      system,
      prompt,
      tier: "reasoning",
    });

    // Deterministic backstop for the prompt's HARD CONSTRAINT — never
    // fully trust the model to have honored a scope instruction on its
    // own (same reasoning as resolveTopicLanguage overriding exercise
    // language server-side). Retry once with the violation spelled out
    // if the generated files reach outside the resolved scope.
    const requiredScope = resolveProjectLanguageScope(body.topic, learnerContext.pathSubject);
    if (requiredScope) {
      const attemptedLanguages = [...new Set(plan.files.map((f) => f.language))];
      const violates = attemptedLanguages.some((lang) => !requiredScope.includes(lang));
      if (violates) {
        const retry = buildProjectPlanPrompt(learnerContext, body.topic, body.level, {
          attemptedLanguages,
          requiredScope,
        });
        plan = await generateStructured({
          schema: projectPlanSchema,
          responseSchema: projectPlanGeminiSchema,
          system: retry.system,
          prompt: retry.prompt,
          tier: "reasoning",
        });
      }
    }

    const projectId = await convexMutation(api.projects.createProject, {
      userId: user._id,
      topic: body.topic,
      level: body.level,
      title: plan.title,
      description: plan.description,
      files: plan.files,
      tasks: plan.tasks,
      contentLocale: user.locale ?? "en",
    });

    return NextResponse.json({ projectId, plan });
  } catch (err) {
    return handleRouteError(err);
  }
}
