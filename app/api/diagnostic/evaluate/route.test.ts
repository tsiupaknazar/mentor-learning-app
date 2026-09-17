import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";
import { DIAGNOSTIC_QUESTION_COUNT } from "@/lib/schemas";

const { requireCurrentUserMock, generateStructuredMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  generateStructuredMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));

import { POST } from "@/app/api/diagnostic/evaluate/route";

const ONE_ANSWER = [{ prompt: "p", type: "knowledge", subtopic: "s", answer: "a" }];

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
});

describe("POST /api/diagnostic/evaluate", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ topic: "SQL", answers: ONE_ANSWER }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when more answers than DIAGNOSTIC_QUESTION_COUNT.max are submitted", async () => {
    const tooMany = Array.from({ length: DIAGNOSTIC_QUESTION_COUNT.max + 1 }, () => ONE_ANSWER[0]);
    const res = await POST(jsonRequest({ topic: "SQL", answers: tooMany }));
    expect(res.status).toBe(400);
  });

  it("accepts exactly DIAGNOSTIC_QUESTION_COUNT.max answers", async () => {
    generateStructuredMock.mockResolvedValue({
      topic: "SQL",
      subtopics: [],
      suggestedLevel: "junior",
      summary: "s",
    });
    const max = Array.from({ length: DIAGNOSTIC_QUESTION_COUNT.max }, () => ONE_ANSWER[0]);

    const res = await POST(jsonRequest({ topic: "SQL", answers: max }));

    expect(res.status).toBe(200);
  });

  it("returns the generated knowledge profile", async () => {
    const profile = { topic: "SQL", subtopics: [], suggestedLevel: "junior", summary: "s" };
    generateStructuredMock.mockResolvedValue(profile);

    const res = await POST(jsonRequest({ topic: "SQL", answers: ONE_ANSWER }));

    const { body } = await statusAndBody(res);
    expect(body.profile).toEqual(profile);
  });
});
