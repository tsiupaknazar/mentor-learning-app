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

import { POST } from "@/app/api/evaluate/route";

const EXERCISE_ROW = {
  _id: "ex1",
  userId: FAKE_USER._id,
  topicId: "topic1",
  externalId: "ex1",
  subtopic: "closures",
  type: "debugging",
  difficulty: "medium",
  language: "javascript",
  title: "Fix it",
  prompt: "p",
  referenceSolution: "SECRET_REFERENCE_SOLUTION",
};

const VALID_BODY = {
  exerciseId: "ex1",
  submittedAnswer: "my answer",
  hintsUsed: 0,
  solutionRevealed: false,
  sessionId: null,
};

const EVALUATION = {
  result: "correct",
  scores: { correctness: 100, logic: 100, codeQuality: 100, bestPractices: 100, edgeCaseHandling: 100 },
  whatYouDid: "x",
  problem: null,
  whyItMatters: null,
  hint: null,
  nextStep: "next",
  detectedMisconception: null,
  detectedMisconceptionKey: null,
  relatedLessonSection: null,
  mentorFollowUp: null,
};

const ATTEMPT_RESULT = {
  attemptId: "attempt1",
  mastery: { overall: 50 },
  masteryBefore: 42,
  xpAwarded: 100,
  newAchievements: ["first_win"],
};

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
  convexQueryMock.mockResolvedValue(EXERCISE_ROW);
  // recordAttempt / recordActivity / incrementSessionProgress are told apart by their args.
  convexMutationMock.mockImplementation(async (_ref: unknown, args: Record<string, unknown>) => {
    if ("exerciseId" in args) return ATTEMPT_RESULT;
    if ("sessionId" in args) return undefined;
    return []; // recordActivity: no streak badges
  });
  generateStructuredMock.mockResolvedValue({ ...EVALUATION });
});

describe("POST /api/evaluate", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid body", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, hintsUsed: 99 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the exercise doesn't belong to the caller", async () => {
    convexQueryMock.mockResolvedValue({ ...EXERCISE_ROW, userId: "someone-else" });
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("fetches the reference solution server-side and never sends it to the client", async () => {
    const res = await POST(jsonRequest(VALID_BODY));

    const { body } = await statusAndBody(res);
    expect(JSON.stringify(body)).not.toContain("SECRET_REFERENCE_SOLUTION");
    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain("SECRET_REFERENCE_SOLUTION");
    // The learner's own submitted answer is what's graded, not the reference.
    expect(promptArg.prompt).toContain("my answer");
  });

  it("records the attempt, then bumps daily activity", async () => {
    await POST(jsonRequest(VALID_BODY));

    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ exerciseId: "ex1", topicId: "topic1", submittedAnswer: "my answer" })
    );
    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: FAKE_USER._id })
    );
  });

  it("increments session progress only when a sessionId is provided", async () => {
    await POST(jsonRequest(VALID_BODY));
    expect(convexMutationMock).toHaveBeenCalledTimes(2); // recordAttempt + recordActivity, no session call

    convexMutationMock.mockClear();
    await POST(jsonRequest({ ...VALID_BODY, sessionId: "session1" }));
    expect(convexMutationMock).toHaveBeenCalledTimes(3);
    expect(convexMutationMock).toHaveBeenCalledWith(expect.anything(), { sessionId: "session1", exerciseId: "ex1" });
  });

  it("returns what the attempt earned: XP, mastery before/after, and new badges (attempt + streak)", async () => {
    convexMutationMock.mockImplementation(async (_ref: unknown, args: Record<string, unknown>) => {
      if ("exerciseId" in args) return ATTEMPT_RESULT;
      return ["streak_7"];
    });

    const res = await POST(jsonRequest(VALID_BODY));
    const { body } = await statusAndBody(res);

    expect(body.reward).toEqual({
      xpAwarded: 100,
      masteryBefore: 42,
      masteryAfter: 50,
      newAchievements: ["first_win", "streak_7"],
    });
  });

  it("tolerates a backend that predates the reward fields, reporting nothing earned instead of NaN", async () => {
    convexMutationMock.mockImplementation(async (_ref: unknown, args: Record<string, unknown>) => {
      if ("exerciseId" in args) return { attemptId: "attempt1", mastery: { overall: 50 } };
      return undefined; // old recordActivity returned nothing
    });

    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.reward).toEqual({ xpAwarded: 0, masteryBefore: 50, masteryAfter: 50, newAchievements: [] });
  });

  it("returns the evaluation and mastery on success", async () => {
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.evaluation).toEqual(EVALUATION);
    expect(body.mastery).toEqual({ overall: 50 });
  });

  it("refuses with 403 topic_locked, without grading or recording anything, for a topic the learner hasn't reached", async () => {
    convexQueryMock.mockImplementation(async (_ref: unknown, args: Record<string, unknown>) =>
      "exerciseId" in args ? EXERCISE_ROW : { locked: true }
    );

    const res = await POST(jsonRequest(VALID_BODY));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(403);
    expect(body.error).toBe("topic_locked");
    expect(generateStructuredMock).not.toHaveBeenCalled();
    expect(convexMutationMock).not.toHaveBeenCalled(); // no attempt, XP or mastery
  });

  it("checks the lock of the exercise's own topic", async () => {
    await POST(jsonRequest(VALID_BODY));
    expect(convexQueryMock).toHaveBeenCalledWith(expect.anything(), { topicId: "topic1" });
  });

  describe("pointing back at the lesson", () => {
    const SECTIONS = ["What is a tag?", "Common mistakes"];

    it("gives the model the lesson's headings and passes on the section it names", async () => {
      generateStructuredMock.mockResolvedValue({ ...EVALUATION, result: "incorrect", relatedLessonSection: "Common mistakes" });

      const res = await POST(jsonRequest({ ...VALID_BODY, lessonSections: SECTIONS }));

      const { body } = await statusAndBody(res);
      expect(generateStructuredMock.mock.calls[0]![0].prompt).toContain(JSON.stringify(SECTIONS));
      expect(body.evaluation.relatedLessonSection).toBe("Common mistakes");
    });

    it("drops a section the model made up, rather than linking to something that isn't in the lesson", async () => {
      generateStructuredMock.mockResolvedValue({ ...EVALUATION, relatedLessonSection: "Invented heading" });

      const { body } = await statusAndBody(await POST(jsonRequest({ ...VALID_BODY, lessonSections: SECTIONS })));

      expect(body.evaluation.relatedLessonSection).toBeNull();
    });

    it("never offers a section when no lesson was shown", async () => {
      generateStructuredMock.mockResolvedValue({ ...EVALUATION, relatedLessonSection: "What is a tag?" });

      const res = await POST(jsonRequest(VALID_BODY));

      const { body } = await statusAndBody(res);
      expect(generateStructuredMock.mock.calls[0]![0].prompt).toContain('Set "relatedLessonSection" to null');
      expect(body.evaluation.relatedLessonSection).toBeNull();
    });
  });
});
