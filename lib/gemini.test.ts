import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

const { generateContentMock, GoogleGenAIMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  const GoogleGenAIMock = vi.fn().mockImplementation(function GoogleGenAI() {
    return { models: { generateContent: generateContentMock } };
  });
  return { generateContentMock, GoogleGenAIMock };
});

vi.mock("@google/genai", () => ({ GoogleGenAI: GoogleGenAIMock }));

import {
  generateStructured,
  generateText,
  GeminiConfigError,
  GeminiRequestError,
  GeminiValidationError,
} from "@/lib/gemini";

const schema = z.object({ greeting: z.string() });

beforeEach(() => {
  generateContentMock.mockReset();
  GoogleGenAIMock.mockClear();
  vi.stubEnv("GEMINI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateStructured", () => {
  it("throws GeminiConfigError when GEMINI_API_KEY is unset", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(
      generateStructured({ schema, system: "sys", prompt: "p" })
    ).rejects.toBeInstanceOf(GeminiConfigError);
  });

  it("returns the parsed value on a valid first response", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ greeting: "hi" }) });

    const result = await generateStructured({ schema, system: "sys", prompt: "p" });

    expect(result).toEqual({ greeting: "hi" });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("strips ```json code fences before parsing", async () => {
    generateContentMock.mockResolvedValue({
      text: '```json\n{"greeting":"hi"}\n```',
    });

    const result = await generateStructured({ schema, system: "sys", prompt: "p" });

    expect(result).toEqual({ greeting: "hi" });
  });

  it("retries once with a repair prompt when the first response fails validation, and succeeds", async () => {
    generateContentMock
      .mockResolvedValueOnce({ text: JSON.stringify({ wrong: "shape" }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ greeting: "fixed" }) });

    const result = await generateStructured({ schema, system: "sys", prompt: "p" });

    expect(result).toEqual({ greeting: "fixed" });
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    const repairCall = generateContentMock.mock.calls[1]![0];
    expect(repairCall.contents).toContain("failed schema validation");
  });

  it("throws GeminiValidationError when both attempts fail validation", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ wrong: "shape" }) });

    await expect(
      generateStructured({ schema, system: "sys", prompt: "p" })
    ).rejects.toBeInstanceOf(GeminiValidationError);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("throws GeminiValidationError when the response isn't valid JSON", async () => {
    generateContentMock.mockResolvedValue({ text: "not json at all" });

    await expect(
      generateStructured({ schema, system: "sys", prompt: "p" })
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });

  it("wraps a thrown SDK error in GeminiRequestError", async () => {
    generateContentMock.mockRejectedValue(new Error("network down"));

    await expect(
      generateStructured({ schema, system: "sys", prompt: "p" })
    ).rejects.toBeInstanceOf(GeminiRequestError);
  });

  it("uses the reasoning model env var for tier: reasoning", async () => {
    vi.stubEnv("GEMINI_REASONING_MODEL", "gemini-reasoning-test");
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ greeting: "hi" }) });

    await generateStructured({ schema, system: "sys", prompt: "p", tier: "reasoning" });

    expect(generateContentMock.mock.calls[0]![0].model).toBe("gemini-reasoning-test");
  });
});

describe("generateText", () => {
  it("returns the raw response text with no JSON parsing", async () => {
    generateContentMock.mockResolvedValue({ text: "Just a plain sentence." });

    const result = await generateText({ system: "sys", prompt: "p" });

    expect(result).toBe("Just a plain sentence.");
  });

  it("returns an empty string when the SDK returns no text", async () => {
    generateContentMock.mockResolvedValue({ text: undefined });

    const result = await generateText({ system: "sys", prompt: "p" });

    expect(result).toBe("");
  });
});
