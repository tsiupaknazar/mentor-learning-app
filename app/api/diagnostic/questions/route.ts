import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { calibrationSetSchema, diagnosticSetSchema } from "@/lib/schemas";
import { diagnosticSetGeminiSchema } from "@/lib/gemini-schemas";
import { buildCalibrationPrompt, buildDiagnosticPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { handleRouteError } from "@/lib/route-utils";

const requestSchema = z.object({
  topic: z.string().min(1).max(120),
  selfReportedLevel: z.enum(["beginner", "junior", "intermediate", "advanced", "not_sure"]),
});

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());

    const isFullDiagnostic = body.selfReportedLevel === "not_sure";
    const { system, prompt } = isFullDiagnostic
      ? buildDiagnosticPrompt(body.topic, body.selfReportedLevel, user.locale ?? "en")
      : buildCalibrationPrompt(body.topic, body.selfReportedLevel, user.locale ?? "en");
    const diagnostic = await generateStructured({
      schema: isFullDiagnostic ? diagnosticSetSchema : calibrationSetSchema,
      responseSchema: diagnosticSetGeminiSchema,
      system,
      prompt,
      // Planning broad, non-redundant subtopic coverage (rather than a
      // fixed handful of questions) is a harder generation task than the
      // old fixed 5-6 question version — worth the stronger tier.
      tier: "reasoning",
    });

    return NextResponse.json({ diagnostic });
  } catch (err) {
    return handleRouteError(err);
  }
}
