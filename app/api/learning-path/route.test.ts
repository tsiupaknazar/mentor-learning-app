import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER, FAKE_LEARNER_CONTEXT } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, generateStructuredMock, getLearnerContextMock, convexMutationMock } =
  vi.hoisted(() => ({
    requireCurrentUserMock: vi.fn(),
    generateStructuredMock: vi.fn(),
    getLearnerContextMock: vi.fn(),
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
vi.mock("@/lib/learner-context", () => ({ getLearnerContext: getLearnerContextMock }));
vi.mock("@/lib/convex-server", () => ({ convexMutation: convexMutationMock, convexQuery: vi.fn() }));

import { POST } from "@/app/api/learning-path/route";

const PATH = { title: "JS Path", rationale: "r", topics: [] };

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, onboardingComplete: true });
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
  generateStructuredMock.mockResolvedValue(PATH);
  convexMutationMock.mockResolvedValue("path1");
});

describe("POST /api/learning-path", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ topic: "JS", knowledgeProfile: null }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid body", async () => {
    const res = await POST(jsonRequest({ topic: "" }));
    expect(res.status).toBe(400);
  });

  it("generates then persists the path, returning both", async () => {
    const res = await POST(jsonRequest({ topic: "JS", knowledgeProfile: null }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.learningPathId).toBe("path1");
    expect(body.path).toEqual(PATH);
    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: "JS Path", topic: "JS" })
    );
  });

  it("does not fetch learner context for a brand-new user who hasn't completed onboarding", async () => {
    requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, onboardingComplete: false });

    await POST(jsonRequest({ topic: "JS", knowledgeProfile: null }));

    expect(getLearnerContextMock).not.toHaveBeenCalled();
  });

  it("falls back to bare preferences when getLearnerContext throws for an onboarded user", async () => {
    getLearnerContextMock.mockRejectedValue(new Error("boom"));

    const res = await POST(jsonRequest({ topic: "JS", knowledgeProfile: null }));

    expect(res.status).toBe(200);
    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain("foundational concepts");
  });
});
