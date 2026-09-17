import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER, FAKE_LEARNER_CONTEXT } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, generateStructuredMock, getLearnerContextMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  generateStructuredMock: vi.fn(),
  getLearnerContextMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));
vi.mock("@/lib/learner-context", () => ({ getLearnerContext: getLearnerContextMock }));

import { POST } from "@/app/api/concept/route";

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
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
    const res = await POST(jsonRequest({ topic: "" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_request");
  });

  it("returns the generated concept on success", async () => {
    const concept = { topic: "JS", subtopic: "closures", explanation: "e", keyPoints: ["a", "b"], example: null };
    generateStructuredMock.mockResolvedValue(concept);

    const res = await POST(jsonRequest({ topic: "JS", subtopic: "closures" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.concept).toEqual(concept);
  });

  it("falls back to bare user preferences (recentPerformance: 0) when getLearnerContext fails", async () => {
    getLearnerContextMock.mockRejectedValue(new Error("no context yet"));
    generateStructuredMock.mockResolvedValue({
      topic: "JS",
      subtopic: "closures",
      explanation: "e",
      keyPoints: ["a", "b"],
      example: null,
    });

    const res = await POST(jsonRequest({ topic: "JS", subtopic: "closures" }));

    expect(res.status).toBe(200);
    // FAKE_LEARNER_CONTEXT (the non-fallback path) has recentPerformance: 50 —
    // seeing 0 here proves the in-route fallback object was actually used.
    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain('"recentPerformance":0');
  });
});
