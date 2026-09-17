import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { translatedMistakeBatchSchema, translatedMistakeSchema } from "@/lib/schemas";
import { translatedMistakeBatchGeminiSchema } from "@/lib/gemini-schemas";
import { buildMistakeTranslationPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery, convexMutation } from "@/lib/convex-server";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/types/domain";

const requestSchema = z.object({
  mistakeIds: z.array(z.string().min(1)).min(1).max(30),
});

/**
 * Translates a batch of mistake descriptions into the caller's current
 * locale. Same per-row batching approach as /api/translate/exercise — see
 * that route's comment — since the mistakes list is likewise a
 * heterogeneous, freely-mixed set of rows rather than one nested bundle.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const targetLocale: Locale = user.locale ?? "en";
    const mistakeIds = body.mistakeIds as Id<"mistakes">[];

    const rows = await Promise.all(
      mistakeIds.map((mistakeId) => convexQuery(api.mistakes.getMistake, { mistakeId }))
    );
    const owned = rows.filter(
      (r): r is NonNullable<typeof r> => r !== null && r.userId === user._id
    );

    const translated: Record<string, unknown> = {};
    const toGenerate: typeof owned = [];

    await Promise.all(
      owned.map(async (row) => {
        const contentLocale: Locale = row.contentLocale ?? "en";
        if (contentLocale === targetLocale) return;

        const cached = await convexQuery(api.translations.getCachedTranslation, {
          sourceTable: "mistakes",
          sourceId: row._id,
          locale: targetLocale,
        });
        if (cached) {
          translated[row._id] = translatedMistakeSchema.parse(JSON.parse(cached));
        } else {
          toGenerate.push(row);
        }
      })
    );

    if (toGenerate.length > 0) {
      const { system, prompt } = buildMistakeTranslationPrompt(
        toGenerate.map((row) => ({ id: row._id, description: row.description })),
        targetLocale
      );

      const { mistakes } = await generateStructured({
        schema: translatedMistakeBatchSchema,
        responseSchema: translatedMistakeBatchGeminiSchema,
        system,
        prompt,
        tier: "fast",
      });

      const byId = new Map(mistakes.map((m) => [m.id, m]));
      await Promise.all(
        toGenerate.map(async (row) => {
          const result = byId.get(row._id);
          if (!result) return;
          translated[row._id] = result;
          await convexMutation(api.translations.saveTranslation, {
            sourceTable: "mistakes",
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
