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

import { POST } from "@/app/api/exercise/route";

const TOPIC_DATA = {
  topic: { userId: FAKE_USER._id, title: "Closures" },
  progress: { mastery: { overall: 40 }, attemptsCount: 3 },
  pathTopic: "JavaScript",
  parentTopic: null,
  locked: false,
};

const GENERATED_EXERCISE = {
  id: "ex1",
  topic: "JavaScript",
  subtopic: "closures",
  type: "debugging",
  difficulty: "medium",
  language: "javascript",
  title: "Fix it",
  prompt: "p",
  starterCode: null,
  choices: null,
  testCases: null,
  referenceSolution: "function fix() {}",
};

const VALID_BODY = { topicId: "topic1", sessionId: null, challengeMode: false };

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
  convexQueryMock.mockImplementation((_query, args) => {
    if ("limit" in args) return Promise.resolve([]); // listRecentExerciseTitles
    return Promise.resolve(TOPIC_DATA); // getTopic
  });
  convexMutationMock.mockResolvedValue("saved-exercise-id");
  generateStructuredMock.mockResolvedValue({ ...GENERATED_EXERCISE });
});

describe("POST /api/exercise", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid body", async () => {
    const res = await POST(jsonRequest({ topicId: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the topic doesn't belong to the caller", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "limit" in args ? Promise.resolve([]) : Promise.resolve({ ...TOPIC_DATA, topic: { ...TOPIC_DATA.topic, userId: "other" } })
    );
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("returns 403 topic_locked when the topic is locked", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "limit" in args ? Promise.resolve([]) : Promise.resolve({ ...TOPIC_DATA, locked: true })
    );
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(403);
    expect(body.error).toBe("topic_locked");
  });

  it("strips the reference solution before responding to the client", async () => {
    const res = await POST(jsonRequest(VALID_BODY));
    const { body } = await statusAndBody(res);
    expect(body.exercise.referenceSolution).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("function fix()");
  });

  it("overrides the generated language when the topic unambiguously names one", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "limit" in args
        ? Promise.resolve([])
        : Promise.resolve({ ...TOPIC_DATA, topic: { userId: FAKE_USER._id, title: "SQL Joins" } })
    );
    generateStructuredMock.mockResolvedValue({ ...GENERATED_EXERCISE, language: "python" });

    await POST(jsonRequest(VALID_BODY));

    const savedArgs = convexMutationMock.mock.calls[0]![1];
    expect(savedArgs.language).toBe("sql");
  });

  it("stores the markup a CSS exercise is previewed against, and sends it to the browser", async () => {
    generateStructuredMock.mockResolvedValue({
      ...GENERATED_EXERCISE,
      language: "css",
      previewMarkup: "<h1>Title</h1>",
    });

    const res = await POST(jsonRequest(VALID_BODY));

    const { body } = await statusAndBody(res);
    expect(convexMutationMock.mock.calls[0]![1].previewMarkup).toBe("<h1>Title</h1>");
    expect(body.exercise.previewMarkup).toBe("<h1>Title</h1>");
    expect(body.exercise.referenceSolution).toBeUndefined();
  });

  it("passes a higher difficulty ladder rung when challengeMode is set", async () => {
    await POST(jsonRequest({ ...VALID_BODY, challengeMode: true }));

    const promptArg = generateStructuredMock.mock.calls[0]![0];
    // mastery=40, attemptsCount=3 -> base "medium" -> challengeMode bumps to "hard"
    expect(promptArg.prompt).toContain("Target difficulty: hard");
  });

  describe("scaffolding a beginner's first exercises", () => {
    const asBeginner = (attemptsCount: number) => {
      getLearnerContextMock.mockResolvedValue({ ...FAKE_LEARNER_CONTEXT, level: "beginner" });
      convexQueryMock.mockImplementation((_query, args) => {
        if ("limit" in args) return Promise.resolve([]);
        return Promise.resolve({ ...TOPIC_DATA, progress: { mastery: { overall: 0 }, attemptsCount } });
      });
    };
    const promptOf = () => generateStructuredMock.mock.calls[0]![0].prompt as string;

    it("makes the very first exercise a worked example with one blank", async () => {
      asBeginner(0);
      await POST(jsonRequest(VALID_BODY));
      expect(promptOf()).toContain("very first exercise");
      expect(promptOf()).toContain("ONE clearly marked blank");
    });

    it("fades the support on the second, then stops", async () => {
      asBeginner(1);
      await POST(jsonRequest(VALID_BODY));
      expect(promptOf()).toContain("fade the support");

      generateStructuredMock.mockClear();
      asBeginner(2);
      await POST(jsonRequest(VALID_BODY));
      expect(promptOf()).not.toContain("SCAFFOLDING");
    });

    it("never scaffolds someone who isn't a beginner, or a harder variation", async () => {
      convexQueryMock.mockImplementation((_query, args) =>
        Promise.resolve("limit" in args ? [] : { ...TOPIC_DATA, progress: { mastery: { overall: 0 }, attemptsCount: 0 } })
      );
      await POST(jsonRequest(VALID_BODY)); // junior context
      expect(promptOf()).not.toContain("SCAFFOLDING");

      generateStructuredMock.mockClear();
      asBeginner(0);
      await POST(jsonRequest({ ...VALID_BODY, challengeMode: true }));
      expect(promptOf()).not.toContain("SCAFFOLDING");
    });
  });

  it("nudges the exercise types by the learner's learning style", async () => {
    getLearnerContextMock.mockResolvedValue({ ...FAKE_LEARNER_CONTEXT, learningStyle: "more_theory" });
    await POST(jsonRequest(VALID_BODY));
    expect(generateStructuredMock.mock.calls[0]![0].prompt).toContain("prefers understanding over drilling");
  });

  it("caps a beginner's difficulty at hard, even at very high mastery", async () => {
    getLearnerContextMock.mockResolvedValue({ ...FAKE_LEARNER_CONTEXT, level: "beginner" });
    requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, level: "beginner" });
    convexQueryMock.mockImplementation((_query, args) =>
      Promise.resolve("limit" in args ? [] : { ...TOPIC_DATA, progress: { mastery: { overall: 95 }, attemptsCount: 9 } })
    );

    await POST(jsonRequest(VALID_BODY));

    expect(generateStructuredMock.mock.calls[0]![0].prompt).toContain("Target difficulty: hard");
  });
});
