import type { TestConvex } from "convex-test";
import type schema from "./schema";
import type { Id } from "./_generated/dataModel";

type T = TestConvex<typeof schema>;

/** Seeds a minimal, schema-valid `users` row for tests that need a foreign key to point at. */
export async function seedUser(t: T, overrides: Partial<Record<string, unknown>> = {}) {
  return t.run(async (ctx) => {
    return ctx.db.insert("users", {
      clerkId: "clerk_test_user",
      email: "learner@example.com",
      displayName: "Test Learner",
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
      ...overrides,
    });
  });
}

const EMPTY_MASTERY = {
  knowledge: 0,
  application: 0,
  debugging: 0,
  explanation: 0,
  retention: 0,
  overall: 0,
};

/** Seeds a learning path + one topic + a zeroed topicProgress row for it. */
export async function seedTopic(
  t: T,
  userId: Id<"users">,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return t.run(async (ctx) => {
    const learningPathId = await ctx.db.insert("learningPaths", {
      userId,
      topic: "JavaScript",
      title: "JavaScript path",
      rationale: "because",
      isActive: true,
      createdAt: Date.now(),
    });
    const topicId = await ctx.db.insert("topics", {
      learningPathId,
      userId,
      externalId: "closures",
      title: "Closures",
      summary: "Closures summary",
      prerequisiteExternalIds: [],
      orderIndex: 0,
      ...overrides,
    });
    await ctx.db.insert("topicProgress", {
      userId,
      topicId,
      mastery: EMPTY_MASTERY,
      attemptsCount: 0,
      status: "not_started",
    });
    return { learningPathId, topicId };
  });
}

export { EMPTY_MASTERY };
