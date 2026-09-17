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

import { POST } from "@/app/api/project/route";

const VALID_PLAN = {
  title: "Kanban board",
  description: "d",
  files: [{ filename: "index.html", language: "html" }],
  tasks: [{ taskCode: "FE-101", title: "t", requirements: ["r1", "r2"] }],
};

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
  convexMutationMock.mockResolvedValue("project1");
  generateStructuredMock.mockResolvedValue(VALID_PLAN);
});

describe("POST /api/project", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ topic: "JS", level: "junior" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid level", async () => {
    const res = await POST(jsonRequest({ topic: "JS", level: "master" }));
    expect(res.status).toBe(400);
  });

  it("persists the plan and returns it on a single generation with no scope violation", async () => {
    const res = await POST(jsonRequest({ topic: "JS", level: "junior" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.projectId).toBe("project1");
    expect(generateStructuredMock).toHaveBeenCalledTimes(1);
  });

  it("retries once when the generated files violate a markup-only scope constraint", async () => {
    generateStructuredMock
      .mockResolvedValueOnce({
        ...VALID_PLAN,
        files: [{ filename: "script.js", language: "javascript" }],
      })
      .mockResolvedValueOnce(VALID_PLAN);

    const res = await POST(jsonRequest({ topic: "CSS Flexbox", level: "junior" }));

    expect(res.status).toBe(200);
    expect(generateStructuredMock).toHaveBeenCalledTimes(2);
    const retryPrompt = generateStructuredMock.mock.calls[1]![0].prompt;
    expect(retryPrompt).toContain("CORRECTION REQUIRED");
  });

  it("does not retry when the topic has no scope constraint", async () => {
    await POST(jsonRequest({ topic: "Node.js REST APIs", level: "junior" }));

    expect(generateStructuredMock).toHaveBeenCalledTimes(1);
  });
});
