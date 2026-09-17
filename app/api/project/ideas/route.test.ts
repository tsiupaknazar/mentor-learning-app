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

import { POST } from "@/app/api/project/ideas/route";

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
});

describe("POST /api/project/ideas", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ level: "junior" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid level", async () => {
    const res = await POST(jsonRequest({ level: "expert" }));
    expect(res.status).toBe(400);
  });

  it("returns the generated ideas", async () => {
    const ideas = [{ topic: "React", title: "Kanban board", description: "d" }];
    generateStructuredMock.mockResolvedValue({ ideas });

    const res = await POST(jsonRequest({ level: "junior" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.ideas).toEqual(ideas);
  });

  it("falls back to bare user preferences when getLearnerContext fails", async () => {
    getLearnerContextMock.mockRejectedValue(new Error("no path yet"));
    generateStructuredMock.mockResolvedValue({ ideas: [] });

    const res = await POST(jsonRequest({ level: "junior" }));

    expect(res.status).toBe(200);
    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain('"recentPerformance":0');
  });
});
