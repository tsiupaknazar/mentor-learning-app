import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER, FAKE_LEARNER_CONTEXT } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const {
  requireCurrentUserMock,
  generateStructuredMock,
  getLearnerContextMock,
  convexQueryMock,
  convexMutationMock,
} = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  generateStructuredMock: vi.fn(),
  getLearnerContextMock: vi.fn(),
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
vi.mock("@/lib/learner-context", () => ({ getLearnerContext: getLearnerContextMock }));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock, convexMutation: convexMutationMock }));

import { POST } from "@/app/api/practice-problems/route";

const TOPIC_DATA = {
  topic: { _id: "topic1", userId: FAKE_USER._id, title: "Closures" },
  pathTopic: "JavaScript",
};

const PROBLEM = {
  id: "p1",
  topic: "Closures",
  subtopic: "closures",
  type: "debugging",
  difficulty: "easy",
  language: "javascript",
  title: "Fix it",
  prompt: "p",
  starterCode: null,
  choices: null,
  testCases: null,
  referenceSolution: "r",
};

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
  convexQueryMock.mockImplementation((_query, args) => {
    if ("topicId" in args) return Promise.resolve(TOPIC_DATA); // getTopic
    return Promise.resolve([]); // listPracticeProblems
  });
  convexMutationMock.mockResolvedValue("saved-id");
  generateStructuredMock.mockResolvedValue({ problems: [PROBLEM] });
});

describe("POST /api/practice-problems", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ topicIds: ["topic1"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for more than 4 topicIds", async () => {
    const res = await POST(jsonRequest({ topicIds: ["1", "2", "3", "4", "5"] }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when none of the topics belong to the caller", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "topicId" in args
        ? Promise.resolve({ ...TOPIC_DATA, topic: { ...TOPIC_DATA.topic, userId: "other" } })
        : Promise.resolve([])
    );
    const res = await POST(jsonRequest({ topicIds: ["topic1"] }));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("saves each generated problem and returns the created count", async () => {
    const res = await POST(jsonRequest({ topicIds: ["topic1"] }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.createdCount).toBe(1);
    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: "Fix it", topicId: "topic1" })
    );
  });

  it("clamps a non-board difficulty (e.g. 'interview') to 'hard'", async () => {
    generateStructuredMock.mockResolvedValue({ problems: [{ ...PROBLEM, difficulty: "interview" }] });

    await POST(jsonRequest({ topicIds: ["topic1"] }));

    const savedArgs = convexMutationMock.mock.calls[0]![1];
    expect(savedArgs.difficulty).toBe("hard");
  });

  describe("topics the learner hasn't reached", () => {
    const lockedTopic = (id: string, title: string, locked: boolean) => ({
      ...TOPIC_DATA,
      topic: { ...TOPIC_DATA.topic, _id: id, title },
      locked,
    });

    it("refuses with 403 topic_locked, and never calls the AI, when every requested topic is blocked", async () => {
      convexQueryMock.mockImplementation((_query, args) =>
        "topicId" in args ? Promise.resolve(lockedTopic("t1", "Flexbox", true)) : Promise.resolve([])
      );

      const res = await POST(jsonRequest({ topicIds: ["t1"] }));

      const { status, body } = await statusAndBody(res);
      expect(status).toBe(403);
      expect(body.error).toBe("topic_locked");
      expect(generateStructuredMock).not.toHaveBeenCalled();
      expect(convexMutationMock).not.toHaveBeenCalled();
    });

    it("generates only for the open topics when some are blocked", async () => {
      convexQueryMock.mockImplementation((_query, args) => {
        if ("topicId" in args) {
          return Promise.resolve(
            args.topicId === "t1" ? lockedTopic("t1", "HTML structure", false) : lockedTopic("t2", "Flexbox", true)
          );
        }
        return Promise.resolve([]);
      });
      generateStructuredMock.mockResolvedValue({ problems: [{ ...PROBLEM, topic: "HTML structure" }] });

      const res = await POST(jsonRequest({ topicIds: ["t1", "t2"] }));

      expect(res.status).toBe(200);
      const { prompt } = generateStructuredMock.mock.calls[0]![0];
      expect(prompt).toContain("HTML structure");
      expect(prompt).not.toContain("Flexbox");
    });
  });
});
