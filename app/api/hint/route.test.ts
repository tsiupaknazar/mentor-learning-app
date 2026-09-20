import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, generateStructuredMock, convexQueryMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  generateStructuredMock: vi.fn(),
  convexQueryMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock, convexMutation: vi.fn() }));

import { POST } from "@/app/api/hint/route";

const EXERCISE_ROW = {
  _id: "ex1",
  userId: FAKE_USER._id,
  externalId: "ex1",
  subtopic: "closures",
  type: "debugging",
  difficulty: "medium",
  language: "javascript",
  title: "Fix it",
  prompt: "p",
  referenceSolution: "function fix() {}",
};

const VALID_BODY = { exerciseId: "ex1", hintLevel: "direction", learnerAttemptSoFar: null };

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  convexQueryMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  convexQueryMock.mockResolvedValue(EXERCISE_ROW);
});

describe("POST /api/hint", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid hintLevel", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, hintLevel: "give_me_the_answer" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the exercise doesn't belong to the caller", async () => {
    convexQueryMock.mockResolvedValue({ ...EXERCISE_ROW, userId: "someone-else" });
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("never sends the reference solution to the client, only into the prompt", async () => {
    generateStructuredMock.mockResolvedValue({ level: "direction", text: "Think about scope." });

    const res = await POST(jsonRequest(VALID_BODY));

    const { body } = await statusAndBody(res);
    expect(JSON.stringify(body)).not.toContain("function fix()");
    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain("function fix()");
  });

  it("refuses with 403 topic_locked, without calling the AI, for a topic the learner hasn't reached", async () => {
    convexQueryMock.mockImplementation(async (_ref: unknown, args: Record<string, unknown>) =>
      "exerciseId" in args ? EXERCISE_ROW : { locked: true }
    );

    const res = await POST(jsonRequest(VALID_BODY));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(403);
    expect(body.error).toBe("topic_locked");
    expect(generateStructuredMock).not.toHaveBeenCalled();
  });
});
