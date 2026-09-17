import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { translatedExerciseBatchSchema, translatedExerciseSchema } from "@/lib/schemas";
import { translatedExerciseBatchGeminiSchema } from "@/lib/gemini-schemas";
import { buildExerciseTranslationPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery, convexMutation } from "@/lib/convex-server";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/types/domain";

const requestSchema = z.object({
  exerciseIds: z.array(z.string().min(1)).min(1).max(24),
});

/**
 * Translates a batch of exercises (title/subtopic/prompt/choices) into the
 * caller's current locale — see convex/schema.ts's `contentTranslations`
 * comment for the cache this backs. Unlike the learning-path/project
 * routes, this translates a heterogeneous list of independent rows (the
 * practice board mixes exercises from many topics) rather than one nested
 * bundle: each row is cached and matched by its own id, and only rows
 * whose contentLocale doesn't already match the target locale — and
 * aren't already cached — cost a Gemini call, batched into one request.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const targetLocale: Locale = user.locale ?? "en";
    const exerciseIds = body.exerciseIds as Id<"exercises">[];

    const rows = await Promise.all(
      exerciseIds.map((exerciseId) => convexQuery(api.exercises.getExercise, { exerciseId }))
    );
    const owned = rows.filter(
      (r): r is NonNullable<typeof r> => r !== null && r.userId === user._id
    );

    const translated: Record<string, unknown> = {};
    const toGenerate: typeof owned = [];

    await Promise.all(
      owned.map(async (row) => {
        const contentLocale: Locale = row.contentLocale ?? "en";
        if (contentLocale === targetLocale) return; // nothing to translate

        const cached = await convexQuery(api.translations.getCachedTranslation, {
          sourceTable: "exercises",
          sourceId: row._id,
          locale: targetLocale,
        });
        if (cached) {
          translated[row._id] = translatedExerciseSchema.parse(JSON.parse(cached));
        } else {
          toGenerate.push(row);
        }
      })
    );

    if (toGenerate.length > 0) {
      const { system, prompt } = buildExerciseTranslationPrompt(
        toGenerate.map((row) => ({
          id: row._id,
          title: row.title,
          subtopic: row.subtopic,
          prompt: row.prompt,
          choices: row.choices ?? null,
        })),
        targetLocale
      );

      const { exercises } = await generateStructured({
        schema: translatedExerciseBatchSchema,
        responseSchema: translatedExerciseBatchGeminiSchema,
        system,
        prompt,
        tier: "fast",
      });

      const byId = new Map(exercises.map((e) => [e.id, e]));
      await Promise.all(
        toGenerate.map(async (row) => {
          const result = byId.get(row._id);
          if (!result) return; // model dropped this id — leave untranslated, caller falls back to original
          translated[row._id] = result;
          await convexMutation(api.translations.saveTranslation, {
            sourceTable: "exercises",
            sourceId: row._id,
            locale: targetLocale,
            fields: JSON.stringify(result),
          });
        })
      );
    }

    return NextResponse.json({ translated });
  } catch (err) {
    return handleRouteError(err);
  }
}
