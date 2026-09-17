import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser, seedTopic } from "./test-helpers";

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
