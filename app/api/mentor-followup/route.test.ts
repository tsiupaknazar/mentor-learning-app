import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER, FAKE_LEARNER_CONTEXT } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, generateStructuredMock, getLearnerContextMock, convexQueryMock } = vi.hoisted(
  () => ({
    requireCurrentUserMock: vi.fn(),
    generateStructuredMock: vi.fn(),
    getLearnerContextMock: vi.fn(),
    convexQueryMock: vi.fn(),
  })
);

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));
vi.mock("@/lib/learner-context", () => ({ getLearnerContext: getLearnerContextMock }));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock, convexMutation: vi.fn() }));

import { POST } from "@/app/api/mentor-followup/route";

const EXERCISE_ROW = { _id: "ex1", userId: FAKE_USER._id, title: "Fix it", prompt: "p" };

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  convexQueryMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
  convexQueryMock.mockResolvedValue(EXERCISE_ROW);
});

const VALID_BODY = { exerciseId: "ex1", followUpQuestion: "Why?", learnerResponse: "Because" };

describe("POST /api/mentor-followup", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid body", async () => {
    const res = await POST(jsonRequest({ exerciseId: "ex1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the exercise doesn't exist", async () => {
    convexQueryMock.mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("returns 404 when the exercise belongs to a different user", async () => {
    convexQueryMock.mockResolvedValue({ ...EXERCISE_ROW, userId: "someone-else" });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns the mentor's reaction on success", async () => {
    const reaction = { reaction: "Good point.", resolved: true };
    generateStructuredMock.mockResolvedValue(reaction);

    const res = await POST(jsonRequest(VALID_BODY));

    const { body } = await statusAndBody(res);
    expect(body.reaction).toEqual(reaction);
  });
});
