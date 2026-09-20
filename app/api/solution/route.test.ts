import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, convexQueryMock, convexMutationMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  convexQueryMock: vi.fn(),
  convexMutationMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock, convexMutation: convexMutationMock }));

import { POST } from "@/app/api/solution/route";

const EXERCISE_ROW = { _id: "ex1", userId: FAKE_USER._id, topicId: "topic1", referenceSolution: "SECRET_SOLUTION" };
// The route reads, in order: the exercise, its topic (for the lock), then its attempts.
function arrange({ attempts = [{ result: "incorrect" }], locked = false, exercise = EXERCISE_ROW as object } = {}) {
  convexQueryMock
    .mockReset()
    .mockResolvedValueOnce(exercise)
    .mockResolvedValueOnce({ locked })
    .mockResolvedValueOnce(attempts);
}

beforeEach(() => {
  requireCurrentUserMock.mockReset().mockResolvedValue(FAKE_USER);
  convexMutationMock.mockReset().mockResolvedValue(undefined);
  arrange();
});

describe("POST /api/solution", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    expect((await POST(jsonRequest({ exerciseId: "ex1" }))).status).toBe(401);
  });

  it("returns 400 on an invalid body", async () => {
    expect((await POST(jsonRequest({}))).status).toBe(400);
  });

  it("returns 404 for someone else's exercise, without revealing anything", async () => {
    arrange({ exercise: { ...EXERCISE_ROW, userId: "someone-else" } });
    const { status, body } = await statusAndBody(await POST(jsonRequest({ exerciseId: "ex1" })));
    expect(status).toBe(404);
    expect(JSON.stringify(body)).not.toContain("SECRET_SOLUTION");
    expect(convexMutationMock).not.toHaveBeenCalled();
  });

  it("refuses for a topic the learner hasn't reached", async () => {
    arrange({ locked: true });
    const { status, body } = await statusAndBody(await POST(jsonRequest({ exerciseId: "ex1" })));
    expect(status).toBe(403);
    expect(body.error).toBe("topic_locked");
  });

  it("refuses until there has been an attempt that wasn't correct", async () => {
    for (const attempts of [[], [{ result: "correct" }]]) {
      arrange({ attempts });
      const { status, body } = await statusAndBody(await POST(jsonRequest({ exerciseId: "ex1" })));
      expect(status).toBe(403);
      expect(body.error).toBe("solution_unavailable");
      expect(JSON.stringify(body)).not.toContain("SECRET_SOLUTION");
      expect(convexMutationMock).not.toHaveBeenCalled();
    }
  });

  it("gives the solution after a missed attempt, and records that it was shown", async () => {
    arrange({ attempts: [{ result: "correct" }, { result: "partially_correct" }] });
    const { status, body } = await statusAndBody(await POST(jsonRequest({ exerciseId: "ex1" })));

    expect(status).toBe(200);
    expect(body.solution).toBe("SECRET_SOLUTION");
    expect(convexMutationMock).toHaveBeenCalledTimes(1);
    expect(convexMutationMock.mock.calls[0]![1]).toEqual({ exerciseId: "ex1" });
  });
});
