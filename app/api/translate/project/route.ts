import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { translatedProjectSchema } from "@/lib/schemas";
import { translatedProjectGeminiSchema } from "@/lib/gemini-schemas";
import { buildProjectTranslationPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery, convexMutation } from "@/lib/convex-server";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/types/domain";

const requestSchema = z.object({
  projectId: z.string().min(1),
});

/**
 * Translates a project (title/description + all its tasks' title/
 * requirements) into the caller's current locale, on demand — mirrors
 * app/api/translate/learning-path/route.ts. Cache-first via
 * contentTranslations; returns `{ translated: null }` when the project's
 * own contentLocale already matches the caller's locale.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const targetLocale: Locale = user.locale ?? "en";

    const detail = await convexQuery(api.projects.getProjectDetail, {
      projectId: body.projectId as Id<"projects">,
    });
    if (!detail || detail.project.userId !== user._id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const contentLocale: Locale = detail.project.contentLocale ?? "en";
    if (contentLocale === targetLocale) {
      return NextResponse.json({ translated: null });
    }

    const cached = await convexQuery(api.translations.getCachedTranslation, {
      sourceTable: "projects",
      sourceId: body.projectId,
      locale: targetLocale,
    });
    if (cached) {
      return NextResponse.json({ translated: translatedProjectSchema.parse(JSON.parse(cached)) });
    }

    const { system, prompt } = buildProjectTranslationPrompt(
      {
        title: detail.project.title,
        description: detail.project.description,
        tasks: detail.tasks.map((t) => ({ taskCode: t.taskCode, title: t.title, requirements: t.requirements })),
      },
      targetLocale
    );
    const translated = await generateStructured({
      schema: translatedProjectSchema,
      responseSchema: translatedProjectGeminiSchema,
      system,
      prompt,
      tier: "fast",
    });

    await convexMutation(api.translations.saveTranslation, {
      sourceTable: "projects",
      sourceId: body.projectId,
      locale: targetLocale,
      fields: JSON.stringify(translated),
    });

    return NextResponse.json({ translated });
  } catch (err) {
    return handleRouteError(err);
  }
}
