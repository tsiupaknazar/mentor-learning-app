import "server-only";
import { GoogleGenAI, type GenerateContentConfig, type Schema } from "@google/genai";
import { z } from "zod";

/**
 * Server-only Gemini wrapper.
 *
 * Responsibilities (see product spec section 19 "AI Architecture" and
 * section 31 "AI Cost Optimization"):
 *   - Never runs in the browser (`server-only` import enforces this at
 *     build time — importing this file from a client component fails).
 *   - Every structured call is validated with Zod before the caller ever
 *     sees it. AI output is untrusted input, not application state.
 *   - One automatic repair retry: if the model returns JSON that fails
 *     validation, we feed the Zod error back and ask it to fix its own
 *     output once before giving up. This is far cheaper than crashing the
 *     user's session over a stray field.
 *   - Model selection is a parameter, not a hardcoded constant, so callers
 *     can route cheap/simple generations (hints, short feedback) to a
 *     lighter model and reserve the heavier one for full code review /
 *     diagnostic evaluation, per section 31.
 */

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it to your server environment (.env.local) — see .env.example."
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export class GeminiConfigError extends Error {}
export class GeminiValidationError extends Error {
  constructor(message: string, public readonly issues: unknown) {
    super(message);
  }
}
/** The Gemini API call itself failed — bad model name, auth, rate limit, quota, etc. Distinct from a validation failure so routes/logs can tell "Gemini said something we couldn't parse" apart from "Gemini couldn't be reached at all". */
export class GeminiRequestError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
  }
}

export type GeminiModelTier = "fast" | "reasoning";

function resolveModelName(tier: GeminiModelTier): string {
  if (tier === "reasoning") {
    // Check https://ai.google.dev/gemini-api/docs/models for current names —
    // Google rotates/retires model IDs (including whole generations) every
    // few months, faster than this file gets updated.
    return process.env.GEMINI_REASONING_MODEL ?? "gemini-3.6-flash";
  }
  return process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
}

interface GenerateStructuredParams<T> {
  schema: z.ZodType<T>;
  /**
   * Gemini-native schema (lib/gemini-schemas.ts) constraining generation
   * directly, on top of Zod validating the result afterward. Strongly
   * recommended — without it, Gemini's JSON mode guarantees valid JSON but
   * not which keys show up, which was the actual root cause of the
   * intermittent 502s this app shipped with initially. Omit only for
   * schemas Gemini's non-recursive schema language can't express (e.g. the
   * recursive learning-path tree).
   */
  responseSchema?: Schema;
  /** System-level behavioral instructions (persona, constraints). */
  system: string;
  /** The task-specific prompt, including compact learner context. */
  prompt: string;
  /** Defaults to "fast"; use "reasoning" for full code review / diagnostics. */
  tier?: GeminiModelTier;
  generationConfig?: Partial<GenerateContentConfig>;
}

/** Strips ```json fences Gemini sometimes adds despite JSON mode — cheap insurance, not the primary fix. */
function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

/**
 * Calls Gemini, requests raw JSON (constrained by `responseSchema` when
 * given), and validates the result against the given Zod schema. Retries
 * once with the validation error appended to the prompt if the first
 * response doesn't parse or validate. Throws `GeminiRequestError` if the
 * API call itself fails (bad model name, auth, quota — check the server
 * log this throws to for the underlying cause), or `GeminiValidationError`
 * if two well-formed responses in a row still fail schema validation.
 */
export async function generateStructured<T>({
  schema,
  responseSchema,
  system,
  prompt,
  tier = "fast",
  generationConfig,
}: GenerateStructuredParams<T>): Promise<T> {
  const modelName = resolveModelName(tier);
  const config: GenerateContentConfig = {
    systemInstruction: system,
    responseMimeType: "application/json",
    ...(responseSchema ? { responseSchema } : {}),
    temperature: 0.4,
    ...generationConfig,
  };

  const attempt = async (userPrompt: string): Promise<{ raw: string }> => {
    try {
      const result = await getClient().models.generateContent({
        model: modelName,
        contents: userPrompt,
        config,
      });
      return { raw: result.text ?? "" };
    } catch (err) {
      throw new GeminiRequestError(
        `Gemini request failed (model: "${modelName}"). If this is a 404/"not found" error, the model name is likely stale — check https://ai.google.dev/gemini-api/docs/models and update GEMINI_MODEL / GEMINI_REASONING_MODEL.`,
        err
      );
    }
  };

  const parseAndValidate = (raw: string) => {
    let json: unknown;
    try {
      json = JSON.parse(stripCodeFences(raw));
    } catch (err) {
      return { success: false as const, error: `Response was not valid JSON: ${String(err)}` };
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.message, value: json };
    }
    return { success: true as const, value: parsed.data };
  };

  const first = await attempt(prompt);
  const firstResult = parseAndValidate(first.raw);
  if (firstResult.success) return firstResult.value;

  console.error(
    `[gemini] first attempt failed validation (model: ${modelName}): ${firstResult.error}\nraw response (first 500 chars): ${first.raw.slice(0, 500)}`
  );

  // Repair pass: tell the model exactly what was wrong and ask it to fix it.
  const repairPrompt = `${prompt}\n\nYour previous response failed schema validation with this error:\n${firstResult.error}\n\nReturn ONLY corrected JSON matching the required schema. No prose, no markdown fences.`;
  const second = await attempt(repairPrompt);
  const secondResult = parseAndValidate(second.raw);
  if (secondResult.success) return secondResult.value;

  console.error(
    `[gemini] repair attempt also failed validation (model: ${modelName}): ${secondResult.error}\nraw response (first 500 chars): ${second.raw.slice(0, 500)}`
  );

  throw new GeminiValidationError(
    "Gemini output failed schema validation twice.",
    secondResult.error
  );
}

interface GenerateTextParams {
  system: string;
  prompt: string;
  tier?: GeminiModelTier;
}

/** Freeform text generation for conversational mentor follow-ups (e.g. interview mode). */
export async function generateText({ system, prompt, tier = "fast" }: GenerateTextParams): Promise<string> {
  const result = await getClient().models.generateContent({
    model: resolveModelName(tier),
    contents: prompt,
    config: { systemInstruction: system, temperature: 0.6 },
  });
  return result.text ?? "";
}
