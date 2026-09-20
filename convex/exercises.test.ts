import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser, seedTopic } from "./test.helpers";

function exerciseArgs(topicId: string, overrides: Record<string, unknown> = {}) {
  return {
    topicId: topicId as never,
    externalId: "ex1",
    subtopic: "closures",
    type: "debugging" as const,
    difficulty: "medium" as const,
    language: "javascript" as const,
    title: "Fix the counter",
    prompt: "Fix it.",
    referenceSolution: "function counter() {}",
    ...overrides,
  };
}

describe("saveGeneratedExercise / getExercise", () => {
  it("saves and fetches an exercise by id", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    const exerciseId = await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicId),
    });

    const exercise = await t.query(api.exercises.getExercise, { exerciseId });
    expect(exercise?.title).toBe("Fix the counter");
  });
});

describe("listPracticeProblems", () => {
  it("only includes standalone exercises (no sessionId)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicId, { externalId: "standalone" }),
    });
    await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("sessions", {
        userId,
        topicId: topicId as never,
        objective: "practice",
        startedAt: Date.now(),
        exercisesPlanned: 1,
        exercisesCompleted: 0,
      });
      await ctx.db.insert("exercises", {
        userId,
        topicId: topicId as never,
        sessionId,
        externalId: "session-bound",
        subtopic: "closures",
        type: "debugging",
        difficulty: "medium",
        language: "javascript",
        title: "Session exercise",
        prompt: "p",
        referenceSolution: "r",
        createdAt: Date.now(),
      });
    });

    const problems = await t.query(api.exercises.listPracticeProblems, { userId });
    expect(problems).toHaveLength(1);
    expect(problems[0]!.title).toBe("Fix the counter");
  });

  it("derives solved/attempted/unsolved status from attempts", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    const solvedId = await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicId, { externalId: "solved" }),
    });
    const attemptedId = await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicId, { externalId: "attempted" }),
    });
    await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicId, { externalId: "untouched" }),
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("attempts", {
        userId,
        exerciseId: solvedId,
        topicId: topicId as never,
        submittedAnswer: "a",
        hintsUsed: 0,
        solutionRevealed: false,
        result: "correct",
        scores: { correctness: 100, logic: 100, codeQuality: 100, bestPractices: 100, edgeCaseHandling: 100 },
        feedback: { whatYouDid: "x", nextStep: "y" },
        submittedAt: Date.now(),
      });
      await ctx.db.insert("attempts", {
        userId,
        exerciseId: attemptedId,
        topicId: topicId as never,
        submittedAnswer: "a",
        hintsUsed: 0,
        solutionRevealed: false,
        result: "incorrect",
        scores: { correctness: 0, logic: 0, codeQuality: 0, bestPractices: 0, edgeCaseHandling: 0 },
        feedback: { whatYouDid: "x", nextStep: "y" },
        submittedAt: Date.now(),
      });
    });

    const problems = await t.query(api.exercises.listPracticeProblems, { userId });
    const byId = (id: string) => problems.find((p) => p._id === id)?.status;
    expect(byId(solvedId)).toBe("solved");
    expect(byId(attemptedId)).toBe("attempted");
    const untouched = problems.find((p) => p._id !== solvedId && p._id !== attemptedId);
    expect(untouched?.status).toBe("unsolved");
  });

  it("filters by topicIds when given", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId: topicA } = await seedTopic(t, userId);
    const { topicId: topicB } = await seedTopic(t, userId, { externalId: "other-topic" });

    await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicA, { externalId: "a" }),
    });
    await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicB, { externalId: "b" }),
    });

    const problems = await t.query(api.exercises.listPracticeProblems, {
      userId,
      topicIds: [topicA as never],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]!.topicId).toBe(topicA);
  });
});

describe("listRecentExerciseTitles", () => {
  it("returns titles for a topic, most recent first, limited", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicId, { externalId: "1", title: "First" }),
    });
    await t.mutation(api.exercises.saveGeneratedExercise, {
      userId,
      ...exerciseArgs(topicId, { externalId: "2", title: "Second" }),
    });

    const titles = await t.query(api.exercises.listRecentExerciseTitles, { topicId, limit: 1 });
    expect(titles).toEqual(["Second"]);
  });
});

describe("markSolutionRevealed", () => {
  it("records when the solution was shown, and keeps the first time", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await t.mutation(api.exercises.saveGeneratedExercise, { userId, ...exerciseArgs(topicId) } as never);
    expect((await t.run((ctx) => ctx.db.get(exerciseId)))!.solutionRevealedAt).toBeUndefined();

    await t.mutation(api.exercises.markSolutionRevealed, { exerciseId });
    const first = (await t.run((ctx) => ctx.db.get(exerciseId)))!.solutionRevealedAt;
    expect(first).toBeTypeOf("number");

    await new Promise((r) => setTimeout(r, 5));
    await t.mutation(api.exercises.markSolutionRevealed, { exerciseId });
    expect((await t.run((ctx) => ctx.db.get(exerciseId)))!.solutionRevealedAt).toBe(first);
  });
});
