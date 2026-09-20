import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser, seedTopic } from "./test.helpers";

describe("startSession / getSession", () => {
  it("creates a session with 0 exercises completed", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    const sessionId = await t.mutation(api.sessions.startSession, {
      userId,
      topicId,
      objective: "practice closures",
      exercisesPlanned: 3,
    });

    const session = await t.query(api.sessions.getSession, { sessionId });
    expect(session?.exercisesCompleted).toBe(0);
    expect(session?.completedAt).toBeUndefined();
  });
});

describe("startSession mode", () => {
  it("records which flow started the session, so only a Learn session can count as learning", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    const learn = await t.mutation(api.sessions.startSession, { userId, topicId, objective: "o", exercisesPlanned: 3, mode: "learn" });
    const practice = await t.mutation(api.sessions.startSession, { userId, topicId, objective: "o", exercisesPlanned: 3, mode: "practice" });
    const unspecified = await t.mutation(api.sessions.startSession, { userId, topicId, objective: "o", exercisesPlanned: 3 });

    expect((await t.query(api.sessions.getSession, { sessionId: learn }))?.mode).toBe("learn");
    expect((await t.query(api.sessions.getSession, { sessionId: practice }))?.mode).toBe("practice");
    expect((await t.query(api.sessions.getSession, { sessionId: unspecified }))?.mode).toBeUndefined();
  });
});

describe("incrementSessionProgress", () => {
  it("increments progress without completing before the target is reached", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const sessionId = await t.mutation(api.sessions.startSession, {
      userId,
      topicId,
      objective: "o",
      exercisesPlanned: 3,
    });

    await t.mutation(api.sessions.incrementSessionProgress, { sessionId });

    const session = await t.query(api.sessions.getSession, { sessionId });
    expect(session?.exercisesCompleted).toBe(1);
    expect(session?.completedAt).toBeUndefined();
  });

  it("sets completedAt once exercisesCompleted reaches exercisesPlanned", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const sessionId = await t.mutation(api.sessions.startSession, {
      userId,
      topicId,
      objective: "o",
      exercisesPlanned: 2,
    });

    await t.mutation(api.sessions.incrementSessionProgress, { sessionId });
    await t.mutation(api.sessions.incrementSessionProgress, { sessionId });

    const session = await t.query(api.sessions.getSession, { sessionId });
    expect(session?.exercisesCompleted).toBe(2);
    expect(session?.completedAt).toBeDefined();
  });

  it("does nothing for a nonexistent session", async () => {
    const t = convexTest(schema);
    const fakeId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "x",
        email: "x@example.com",
        displayName: "x",
        level: "junior",
        learningGoal: "improve_skills",
        learningStyle: "balanced",
        dailyTime: "30min",
        onboardingComplete: true,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: "2024-01-01",
        totalXp: 0,
        createdAt: Date.now(),
      });
      const learningPathId = await ctx.db.insert("learningPaths", {
        userId,
        topic: "t",
        title: "t",
        rationale: "r",
        isActive: true,
        createdAt: Date.now(),
      });
      const topicId = await ctx.db.insert("topics", {
        learningPathId,
        userId,
        externalId: "x",
        title: "x",
        summary: "x",
        prerequisiteExternalIds: [],
        orderIndex: 0,
      });
      const sessionId = await ctx.db.insert("sessions", {
        userId,
        topicId,
        objective: "o",
        startedAt: Date.now(),
        exercisesPlanned: 1,
        exercisesCompleted: 0,
      });
      await ctx.db.delete(sessionId);
      return sessionId;
    });

    await expect(
      t.mutation(api.sessions.incrementSessionProgress, { sessionId: fakeId })
    ).resolves.toBeNull();
  });
});

describe("listRecentSessions", () => {
  it("returns the user's sessions newest first, respecting the limit", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    await t.mutation(api.sessions.startSession, { userId, topicId, objective: "first", exercisesPlanned: 1 });
    await t.mutation(api.sessions.startSession, { userId, topicId, objective: "second", exercisesPlanned: 1 });

    const sessions = await t.query(api.sessions.listRecentSessions, { userId, limit: 1 });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.objective).toBe("second");
  });
});

type Ids = { userId: string; topicId: string };

async function seedExercise(t: ReturnType<typeof convexTest>, { userId, topicId }: Ids, externalId: string) {
  return t.run((ctx) =>
    ctx.db.insert("exercises", {
      userId: userId as never,
      topicId: topicId as never,
      externalId,
      subtopic: "closures",
      type: "debugging",
      difficulty: "medium",
      language: "javascript",
      title: externalId,
      prompt: "p",
      referenceSolution: "s",
      createdAt: Date.now(),
    })
  );
}

/** Records one attempt, as /api/evaluate's recordAttempt does just before it bumps the session. */
async function addAttempt(t: ReturnType<typeof convexTest>, { userId, topicId }: Ids, exerciseId: string) {
  await t.run((ctx) =>
    ctx.db.insert("attempts", {
      userId: userId as never,
      exerciseId: exerciseId as never,
      topicId: topicId as never,
      submittedAnswer: "a",
      hintsUsed: 0,
      solutionRevealed: false,
      result: "incorrect",
      scores: { correctness: 0, logic: 0, codeQuality: 0, bestPractices: 0, edgeCaseHandling: 0 },
      feedback: { whatYouDid: "w", nextStep: "n" },
      submittedAt: Date.now(),
    })
  );
}

describe("incrementSessionProgress counts exercises, not submissions", () => {
  async function setup(planned: number) {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const sessionId = await t.mutation(api.sessions.startSession, { userId, topicId, objective: "o", exercisesPlanned: planned });
    return { t, ids: { userId, topicId }, sessionId };
  }

  it("does not count a revised resubmission of the same exercise a second time", async () => {
    const { t, ids, sessionId } = await setup(3);
    const exerciseId = await seedExercise(t, ids, "e1");

    // First submission -> counts.
    await addAttempt(t, ids, exerciseId);
    await t.mutation(api.sessions.incrementSessionProgress, { sessionId, exerciseId });
    expect((await t.query(api.sessions.getSession, { sessionId }))?.exercisesCompleted).toBe(1);

    // "Revise and resubmit": a second attempt on the SAME exercise -> does not.
    await addAttempt(t, ids, exerciseId);
    await t.mutation(api.sessions.incrementSessionProgress, { sessionId, exerciseId });
    expect((await t.query(api.sessions.getSession, { sessionId }))?.exercisesCompleted).toBe(1);
  });

  it("only completes the session once the planned number of DIFFERENT exercises are done", async () => {
    const { t, ids, sessionId } = await setup(2);
    const first = await seedExercise(t, ids, "e1");
    const second = await seedExercise(t, ids, "e2");

    // Exercise 1 submitted twice (revised), exercise 2 not yet.
    for (let i = 0; i < 2; i++) {
      await addAttempt(t, ids, first);
      await t.mutation(api.sessions.incrementSessionProgress, { sessionId, exerciseId: first });
    }
    let session = await t.query(api.sessions.getSession, { sessionId });
    expect(session?.exercisesCompleted).toBe(1);
    expect(session?.completedAt).toBeUndefined(); // previously "complete" after just 2 submissions

    await addAttempt(t, ids, second);
    await t.mutation(api.sessions.incrementSessionProgress, { sessionId, exerciseId: second });
    session = await t.query(api.sessions.getSession, { sessionId });
    expect(session?.exercisesCompleted).toBe(2);
    expect(session?.completedAt).toBeDefined();
  });

  it("still counts every call when no exercise id is given (older callers)", async () => {
    const { t, sessionId } = await setup(3);
    await t.mutation(api.sessions.incrementSessionProgress, { sessionId });
    await t.mutation(api.sessions.incrementSessionProgress, { sessionId });
    expect((await t.query(api.sessions.getSession, { sessionId }))?.exercisesCompleted).toBe(2);
  });

  it("never reports more completed than planned", async () => {
    const { t, sessionId } = await setup(2);
    for (let i = 0; i < 5; i++) await t.mutation(api.sessions.incrementSessionProgress, { sessionId });
    expect((await t.query(api.sessions.getSession, { sessionId }))?.exercisesCompleted).toBe(2);
  });
});

describe("listRecentSessions topic titles", () => {
  it("includes each session's topic title, or null if the topic is gone", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId, { title: "Closures" });
    const other = await seedTopic(t, userId, { title: "Promises" });
    await t.mutation(api.sessions.startSession, { userId, topicId, objective: "o", exercisesPlanned: 1 });
    await t.mutation(api.sessions.startSession, { userId, topicId: other.topicId, objective: "o", exercisesPlanned: 1 });
    await t.run((ctx) => ctx.db.delete(other.topicId));

    const sessions = await t.query(api.sessions.listRecentSessions, { userId });

    expect(sessions.map((s) => s.topicTitle)).toEqual([null, "Closures"]); // newest first
  });
});
