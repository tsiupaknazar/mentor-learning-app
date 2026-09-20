import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { conceptSchema } from "@/lib/schemas";
import { conceptGeminiSchema } from "@/lib/gemini-schemas";
import { buildConceptPrompt } from "@/lib/prompts";
import { conceptCacheKey } from "@/lib/concept-depth";
import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";

const requestSchema = z.object({
  topic: z.string().min(1).max(120),
  subtopic: z.string().min(1).max(120),
  // Absent from older clients: a beginner then gets the full lesson, as before.
  depth: z.enum(["quick", "full"]).optional(),
});

/**
 * The theory shown before a topic's exercises (spec section 6: "Quick
 * concept" + "Example"): a short refresher ("quick"), or a guided
 * multi-section lesson ("full"). It is supplementary teaching content, not a
 * graded artifact.
 *
 * Generated lessons are shared: the prompt depends only on the topic, depth
 * and the learner's level/style/language (see ConceptContext in
 * lib/prompts.ts), so the first request for a combination generates it and
 * stores it in Convex, and everyone after gets that copy instantly. The full
 * lesson is worth the slower "reasoning" model precisely because it's
 * generated once for many learners, and it is the one a beginner learns from.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());

    const ctx = {
      level: user.level,
      learningStyle: user.learningStyle,
      locale: user.locale ?? "en",
    } as const;
    const depth = body.depth ?? (ctx.level === "beginner" ? "full" : "quick");
    const key = conceptCacheKey({
      topic: body.topic,
      subtopic: body.subtopic,
      depth,
      level: ctx.level,
      style: ctx.learningStyle,
      locale: ctx.locale,
    });

    // The cache is an optimization: a failure to read or write it must never
    // stop the learner getting a lesson.
    const cached = await convexQuery(api.concepts.getCachedConcept, { key }).catch(() => null);
    if (cached) {
      try {
        const parsed = conceptSchema.safeParse(JSON.parse(cached));
        if (parsed.success) return NextResponse.json({ concept: parsed.data });
      } catch {
        // Unreadable row: fall through and regenerate.
      }
    }

    const { system, prompt } = buildConceptPrompt(ctx, body.topic, body.subtopic, depth);
    const concept = await generateStructured({
      schema: conceptSchema,
      responseSchema: conceptGeminiSchema,
      system,
      prompt,
      tier: depth === "full" ? "reasoning" : "fast",
    });

    await convexMutation(api.concepts.saveConcept, { key, concept: JSON.stringify(concept) }).catch(() => undefined);

    return NextResponse.json({ concept });
  } catch (err) {
    return handleRouteError(err);
  }
}
