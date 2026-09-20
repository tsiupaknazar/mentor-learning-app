import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, generateStructuredMock, convexQueryMock, convexMutationMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  generateStructuredMock: vi.fn(),
  convexQueryMock: vi.fn(),
  convexMutationMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock, convexMutation: convexMutationMock }));

import { POST } from "@/app/api/concept/route";

const CONCEPT = { topic: "JS", subtopic: "closures", explanation: "e", keyPoints: ["a", "b"], example: null };

beforeEach(() => {
  requireCurrentUserMock.mockReset().mockResolvedValue(FAKE_USER);
  generateStructuredMock.mockReset().mockResolvedValue({ ...CONCEPT });
  convexQueryMock.mockReset().mockResolvedValue(null); // cache miss
  convexMutationMock.mockReset().mockResolvedValue("cache-row");
});

describe("POST /api/concept", () => {
  it("returns 401 when the caller is not authenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());

    const res = await POST(jsonRequest({ topic: "JS", subtopic: "closures" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(401);
    expect(body.error).toBe("unauthenticated");
    expect(generateStructuredMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid body", async () => {
    for (const bad of [{ topic: "" }, { topic: "JS", subtopic: "x", depth: "huge" }]) {
      const { status, body } = await statusAndBody(await POST(jsonRequest(bad)));
      expect(status).toBe(400);
      expect(body.error).toBe("invalid_request");
    }
  });

  it("generates the concept on a cache miss and stores it for the next learner", async () => {
    const res = await POST(jsonRequest({ topic: "JS", subtopic: "closures", depth: "quick" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.concept).toEqual(CONCEPT);
    expect(convexMutationMock).toHaveBeenCalledTimes(1);
    const saved = convexMutationMock.mock.calls[0]![1];
    expect(saved.key).toBe("v1|js|closures|quick|junior|balanced|en");
    expect(JSON.parse(saved.concept)).toEqual(CONCEPT);
  });

  it("serves a cached lesson without calling Gemini or writing anything", async () => {
    const cached = { ...CONCEPT, explanation: "from the cache" };
    convexQueryMock.mockResolvedValue(JSON.stringify(cached));

    const res = await POST(jsonRequest({ topic: "JS", subtopic: "closures", depth: "quick" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.concept.explanation).toBe("from the cache");
    expect(generateStructuredMock).not.toHaveBeenCalled();
    expect(convexMutationMock).not.toHaveBeenCalled();
  });

  it("looks a lesson up by everything its content depends on, and nothing else", async () => {
    requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, level: "beginner", learningStyle: "more_theory", locale: "uk" });

    await POST(jsonRequest({ topic: " HTML ", subtopic: "Headings", depth: "full" }));

    expect(convexQueryMock.mock.calls[0]![1]).toEqual({ key: "v1|html|headings|full|beginner|more_theory|uk" });
  });

  it("regenerates rather than serving a cached row that is corrupt or no longer matches the schema", async () => {
    for (const bad of ["not json", JSON.stringify({ topic: "JS" })]) {
      generateStructuredMock.mockClear();
      convexQueryMock.mockResolvedValue(bad);

      const res = await POST(jsonRequest({ topic: "JS", subtopic: "closures", depth: "quick" }));

      expect(res.status).toBe(200);
      expect(generateStructuredMock).toHaveBeenCalledTimes(1);
    }
  });

  it("still returns the lesson when the cache can't be read or written", async () => {
    convexQueryMock.mockRejectedValue(new Error("convex down"));
    convexMutationMock.mockRejectedValue(new Error("convex down"));

    const res = await POST(jsonRequest({ topic: "JS", subtopic: "closures" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.concept).toEqual(CONCEPT);
  });

  it("uses the slower reasoning model only for the full lesson", async () => {
    await POST(jsonRequest({ topic: "JS", subtopic: "closures", depth: "full" }));
    expect(generateStructuredMock.mock.calls[0]![0].tier).toBe("reasoning");

    generateStructuredMock.mockClear();
    convexQueryMock.mockResolvedValue(null);
    await POST(jsonRequest({ topic: "JS", subtopic: "closures", depth: "quick" }));
    expect(generateStructuredMock.mock.calls[0]![0].tier).toBe("fast");
  });

  it("defaults the depth from the learner's level when the client doesn't say", async () => {
    requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, level: "beginner" });
    await POST(jsonRequest({ topic: "JS", subtopic: "closures" }));
    expect(generateStructuredMock.mock.calls[0]![0].system).toContain("ABSOLUTE BEGINNER");

    generateStructuredMock.mockClear();
    requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, level: "advanced" });
    await POST(jsonRequest({ topic: "JS", subtopic: "closures" }));
    expect(generateStructuredMock.mock.calls[0]![0].system).not.toContain("ABSOLUTE BEGINNER");
  });

  it("puts nothing personal in the prompt, since the result is shared", async () => {
    await POST(jsonRequest({ topic: "JS", subtopic: "closures", depth: "quick" }));

    const { prompt } = generateStructuredMock.mock.calls[0]![0];
    for (const personal of ["weakTopics", "recurringMistakes", "recentPerformance", "learningGoal"]) {
      expect(prompt).not.toContain(personal);
    }
  });
});
