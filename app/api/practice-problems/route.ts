import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { practiceProblemSetSchema } from "@/lib/schemas";
import { practiceProblemSetGeminiSchema } from "@/lib/gemini-schemas";
import { buildPracticeProblemSetPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { getLearnerContext } from "@/lib/learner-context";
import { resolveTopicLanguage } from "@/lib/topic-language";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const requestSchema = z.object({
  topicIds: z.array(z.string().min(1)).min(1).max(4),
});

const PER_TOPIC_COUNTS = { easy: 2, medium: 2, hard: 2 };

/**
 * Generates a batch of standalone practice problems (Practice board /
 * Codewars-style card list) for a set of topics in a single Gemini call,
 * then stores each as its own `exercises` row with no `sessionId` — the
 * same mechanism the adaptive Learn/Practice-drill flow uses, just not
 * attached to a session, so these are independently browsable and solvable.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const topicIds = body.topicIds as Id<"topics">[];

    const topicRows = await Promise.all(
      topicIds.map((topicId) => convexQuery(api.learningPaths.getTopic, { topicId }))
    );
    const ownedTopics = topicRows.filter(
      (t): t is NonNullable<typeof t> => t !== null && t.topic.userId === user._id
    );
    if (ownedTopics.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // Practice is for topics the learner has reached. Generating problems for
    // one that's still ahead of them in the path is how practising used to
    // run ahead of learning; the Practice page never offers such topics, this
    // is the guard for anything that gets around it.
    const validTopics = ownedTopics.filter((t) => !t.locked);
    if (validTopics.length === 0) {
      return NextResponse.json({ error: "topic_locked" }, { status: 403 });
    }

    const existing = await convexQuery(api.exercises.listPracticeProblems, {
      userId: user._id,
      topicIds: validTopics.map((t) => t.topic._id),
    });
    const avoidTitles = existing.map((p) => p.title).slice(0, 30);

    // Deterministic per-topic language, not left to Gemini's judgment (it
    // otherwise defaults to Python for generic algorithm-style problems
    // even when the topic itself names a specific language). Falls back to
    // the learning path's own subject when the subtopic title itself is
    // language-agnostic (e.g. "Loops" under a "JavaScript" path) — see
    // resolveTopicLanguage for why this fallback matters.
    const languageByTopicTitle = new Map(
      validTopics.map((t) => [t.topic.title, resolveTopicLanguage(t.topic.title, t.pathTopic)])
    );

    const learnerContext = await getLearnerContext(user._id);
    const { system, prompt } = buildPracticeProblemSetPrompt(
      learnerContext,
      validTopics.map((t) => ({ title: t.topic.title, language: languageByTopicTitle.get(t.topic.title) ?? null })),
      PER_TOPIC_COUNTS,
      avoidTitles
    );

    const { problems } = await generateStructured({
      schema: practiceProblemSetSchema,
      responseSchema: practiceProblemSetGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });

    const titleToTopicId = new Map(validTopics.map((t) => [t.topic.title.trim().toLowerCase(), t.topic._id]));
    const fallbackTopicId = validTopics[0]!.topic._id;
    const fallbackTopicTitle = validTopics[0]!.topic.title;
    const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

    const createdIds = await Promise.all(
      problems.map((p) => {
        const matchedTitle = titleToTopicId.has(p.topic.trim().toLowerCase()) ? p.topic.trim() : fallbackTopicTitle;
        const topicId = titleToTopicId.get(matchedTitle.trim().toLowerCase()) ?? fallbackTopicId;
        // Enforce the required language deterministically — never trust the
        // model's own choice for a topic that unambiguously names one.
        const requiredLanguage = languageByTopicTitle.get(matchedTitle) ?? null;
        return convexMutation(api.exercises.saveGeneratedExercise, {
          userId: user._id,
          topicId,
          // Deliberately no sessionId — a standalone, browsable board problem,
          // not part of a generated-on-the-fly Learn/Practice-drill session.
          sessionId: undefined,
          externalId: p.id,
          subtopic: p.subtopic,
          type: p.type,
          // Board problems are always easy/medium/hard; clamp anything else
          // the model might slip past the prompt instruction.
          difficulty: ALLOWED_DIFFICULTIES.has(p.difficulty) ? p.difficulty : "hard",
          language: requiredLanguage ?? p.language,
          title: p.title,
          prompt: p.prompt,
          contentLocale: learnerContext.locale,
          starterCode: p.starterCode ?? undefined,
          choices: p.choices ?? undefined,
          testCases: p.testCases
            ? p.testCases.map((tc) => ({ ...tc, description: tc.description ?? undefined }))
            : undefined,
          referenceSolution: p.referenceSolution,
          // Only meaningful (and only asked for) when the problem is CSS.
          previewMarkup: (requiredLanguage ?? p.language) === "css" ? (p.previewMarkup ?? undefined) : undefined,
        });
      })
    );

    return NextResponse.json({ createdCount: createdIds.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
