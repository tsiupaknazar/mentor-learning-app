import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { translatedLearningPathSchema } from "@/lib/schemas";
import { translatedLearningPathGeminiSchema } from "@/lib/gemini-schemas";
import { buildLearningPathTranslationPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery, convexMutation } from "@/lib/convex-server";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/types/domain";

const requestSchema = z.object({
  learningPathId: z.string().min(1),
});

/**
 * Translates a learning path (title/rationale/summary + all its topics) into
 * the caller's current locale, on demand — see convex/schema.ts's
 * `contentTranslations` comment for why this exists instead of translating
 * at generation time. Cache-first: returns the stored translation if one
 * already exists, otherwise calls Gemini once and caches the result for
 * every future view. Returns `{ translated: null }` when the path's own
 * contentLocale already matches — nothing to translate.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const targetLocale: Locale = user.locale ?? "en";

    const data = await convexQuery(api.learningPaths.getLearningPathWithTopics, {
      learningPathId: body.learningPathId as Id<"learningPaths">,
    });
    if (!data || data.path.userId !== user._id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const contentLocale: Locale = data.path.contentLocale ?? "en";
    if (contentLocale === targetLocale) {
      return NextResponse.json({ translated: null });
    }

    const cached = await convexQuery(api.translations.getCachedTranslation, {
      sourceTable: "learningPaths",
      sourceId: body.learningPathId,
      locale: targetLocale,
    });
    if (cached) {
      return NextResponse.json({ translated: translatedLearningPathSchema.parse(JSON.parse(cached)) });
    }

    const { system, prompt } = buildLearningPathTranslationPrompt(
      {
        title: data.path.title,
        rationale: data.path.rationale,
        knowledgeProfileSummary: data.path.knowledgeProfileSummary ?? null,
        topics: data.topics.map((t) => ({ externalId: t.externalId, title: t.title, summary: t.summary })),
      },
      targetLocale
    );
    const translated = await generateStructured({
      schema: translatedLearningPathSchema,
      responseSchema: translatedLearningPathGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });

    await convexMutation(api.translations.saveTranslation, {
      sourceTable: "learningPaths",
      sourceId: body.learningPathId,
      locale: targetLocale,
      fields: JSON.stringify(translated),
    });

    return NextResponse.json({ translated });
  } catch (err) {
    return handleRouteError(err);
  }
}
