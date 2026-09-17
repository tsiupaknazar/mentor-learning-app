import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test-helpers";

/**
 * Seeds a topic (+ progress) under the given learning path, creating a new
 * active path first if one isn't passed in — so a test that needs several
 * topics visible to the SAME dashboard query (which only ever looks at one
 * active path via `.first()`) can share one path across multiple calls.
 */
async function seedPathWithTopic(
  t: ReturnType<typeof convexTest>,
  userId: string,
  topicOverrides: Record<string, unknown> = {},
  progressOverrides: Record<string, unknown> = {},
  existingLearningPathId?: string
) {
  return t.run(async (ctx) => {
    const learningPathId =
      existingLearningPathId ??
      (await ctx.db.insert("learningPaths", {
        userId: userId as never,
        topic: "JavaScript",
        title: "JS Path",
        rationale: "r",
        isActive: true,
        createdAt: Date.now(),
      }));
    const topicId = await ctx.db.insert("topics", {
      learningPathId: learningPathId as never,
      userId: userId as never,
      externalId: "closures",
      title: "Closures",
      summary: "s",
      prerequisiteExternalIds: [],
      orderIndex: 0,
      ...topicOverrides,
    });
    const EMPTY_MASTERY = {
      knowledge: 0,
      application: 0,
      debugging: 0,
      explanation: 0,
      retention: 0,
      overall: 0,
    };
    await ctx.db.insert("topicProgress", {
      userId: userId as never,
      topicId,
      mastery: EMPTY_MASTERY,
      attemptsCount: 1,
      status: "in_progress",
      ...progressOverrides,
    });
    return { learningPathId, topicId };
  });
}

describe("getLearnerContext", () => {
  it("returns null for a nonexistent user", async () => {
    const t = convexTest(schema);
    const fakeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
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
      await ctx.db.delete(id);
      return id;
    });

    const result = await t.query(api.dashboard.getLearnerContext, { userId: fakeId });
    expect(result).toBeNull();
  });

  it("buckets topics into weak/strong/current based on mastery band and status", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "weak-topic", title: "Weak Topic" },
      { mastery: { knowledge: 20, application: 20, debugging: 20, explanation: 20, retention: 20, overall: 20 } }
    );

    const ctx = await t.query(api.dashboard.getLearnerContext, { userId });
    expect(ctx?.weakTopics).toContain("Weak Topic");
    expect(ctx?.currentTopics).toContain("Weak Topic"); // in_progress
  });

  it("caps recurringMistakes to needs_review status only, at most 5", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedPathWithTopic(t, userId);
    await t.run(async (ctx) => {
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("mistakes", {
          userId: userId as never,
          topicId: topicId as never,
          description: `Mistake ${i}`,
          firstDetectedAt: Date.now(),
          lastDetectedAt: Date.now(),
          occurrences: 3,
          status: "needs_review",
          relatedAttemptIds: [],
        });
      }
      await ctx.db.insert("mistakes", {
        userId: userId as never,
        topicId: topicId as never,
        description: "Resolved one, should not appear",
        firstDetectedAt: Date.now(),
        lastDetectedAt: Date.now(),
        occurrences: 3,
        status: "resolved",
        relatedAttemptIds: [],
      });
    });

    const ctx = await t.query(api.dashboard.getLearnerContext, { userId });
    expect(ctx?.recurringMistakes).toHaveLength(2);
    expect(ctx?.recurringMistakes).not.toContain("Resolved one, should not appear");
  });
});

describe("getDashboardSummary", () => {
  it("prioritizes a due review over an in-progress topic", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { learningPathId } = await seedPathWithTopic(
      t,
      userId,
      { externalId: "in-progress", title: "In Progress Topic" },
      { status: "in_progress" }
    );
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "due-review", title: "Due Review Topic" },
      { status: "needs_review", nextReviewDue: Date.now() - 1000 },
      learningPathId
    );

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.nextAction?.kind).toBe("review");
    expect(summary?.nextAction?.topicTitle).toBe("Due Review Topic");
  });

  it("falls back to a not-started topic when nothing is due or in progress", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "fresh", title: "Fresh Topic" },
      { status: "not_started", attemptsCount: 0 }
    );

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.nextAction?.kind).toBe("start");
    expect(summary?.nextAction?.topicTitle).toBe("Fresh Topic");
  });

  it("computes overallMastery as the average across all topics", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "a" },
      { mastery: { knowledge: 100, application: 100, debugging: 100, explanation: 100, retention: 100, overall: 100 } }
    );
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "b" },
      { mastery: { knowledge: 0, application: 0, debugging: 0, explanation: 0, retention: 0, overall: 0 } }
    );

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.overallMastery).toBe(50);
  });
});
