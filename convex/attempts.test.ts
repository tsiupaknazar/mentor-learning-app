import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser, seedTopic } from "./test-helpers";

async function seedExercise(t: ReturnType<typeof convexTest>, userId: string, topicId: string) {
  return t.run(async (ctx) => {
    return ctx.db.insert("exercises", {
      userId: userId as never,
      topicId: topicId as never,
      externalId: "ex1",
      subtopic: "closures",
      type: "debugging",
      difficulty: "medium",
      language: "javascript",
      title: "Fix the counter",
      prompt: "Fix it.",
      referenceSolution: "function counter() {}",
      createdAt: Date.now(),
    });
  });
}

const PERFECT_SCORES = {
  correctness: 100,
  logic: 100,
  codeQuality: 100,
  bestPractices: 100,
  edgeCaseHandling: 100,
};

const BASE_FEEDBACK = { whatYouDid: "did it", nextStep: "next" };

function attemptArgs(overrides: Record<string, unknown> = {}) {
  return {
    submittedAnswer: "my answer",
    hintsUsed: 0,
    solutionRevealed: false,
    result: "correct" as const,
    scores: PERFECT_SCORES,
    feedback: BASE_FEEDBACK,
    exerciseType: "debugging",
    ...overrides,
  };
}

describe("recordAttempt", () => {
  describe("reward reported back to the caller", () => {
    async function setup(userOverrides: Record<string, unknown> = {}) {
      const t = convexTest(schema);
      const userId = await seedUser(t, userOverrides);
      const { topicId } = await seedTopic(t, userId);
      const exerciseId = await seedExercise(t, userId, topicId);
      return { t, userId, topicId, exerciseId };
    }

    it("reports 100 XP, mastery before/after and the first-win badge for a clean first correct answer", async () => {
      const { t, userId, topicId, exerciseId } = await setup();

      const result = await t.mutation(api.attempts.recordAttempt, {
        userId,
        exerciseId,
        topicId,
        ...attemptArgs(),
      });

      expect(result.xpAwarded).toBe(100);
      expect(result.masteryBefore).toBe(0);
      expect(result.mastery.overall).toBeGreaterThan(result.masteryBefore);
      expect(result.newAchievements).toEqual(["first_win"]);
    });

    it("reports less XP for a hinted correct answer and none for an incorrect one, and each badge only once", async () => {
      const { t, userId, topicId, exerciseId } = await setup();
      const args = { userId, exerciseId, topicId };

      const hinted = await t.mutation(api.attempts.recordAttempt, { ...args, ...attemptArgs({ hintsUsed: 2 }) });
      expect(hinted.xpAwarded).toBe(40);
      expect(hinted.newAchievements).toEqual(["first_win"]);

      const wrong = await t.mutation(api.attempts.recordAttempt, {
        ...args,
        ...attemptArgs({ result: "incorrect" as never, scores: { ...PERFECT_SCORES, correctness: 0 } }),
      });
      expect(wrong.xpAwarded).toBe(0);
      expect(wrong.newAchievements).toEqual([]);
      // masteryBefore is the topic's real previous value, not always 0.
      expect(wrong.masteryBefore).toBe(hinted.mastery.overall);

      const again = await t.mutation(api.attempts.recordAttempt, { ...args, ...attemptArgs() });
      expect(again.newAchievements).not.toContain("first_win");
    });

    it("includes the XP-milestone badge when this attempt's XP crosses 500", async () => {
      const { t, userId, topicId, exerciseId } = await setup({ totalXp: 450, totalCorrectAttempts: 5 });

      const result = await t.mutation(api.attempts.recordAttempt, {
        userId,
        exerciseId,
        topicId,
        ...attemptArgs(),
      });

      expect(result.newAchievements).toContain("xp_500");
    });
  });

  it("creates a topicProgress row and marks it in_progress on a first correct attempt below the mastery threshold", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    await t.mutation(
      api.attempts.recordAttempt,
      { userId, exerciseId, topicId, ...attemptArgs({ scores: { ...PERFECT_SCORES, correctness: 40, logic: 40, bestPractices: 40 } }) }
    );

    const progress = await t.run((ctx) =>
      ctx.db
        .query("topicProgress")
        .withIndex("by_user_and_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
        .unique()
    );
    expect(progress?.attemptsCount).toBe(1);
    expect(progress?.status).toBe("in_progress");
  });

  it("marks the topic mastered and awards firstMastery once overall mastery crosses 85, but not again on a later mastered attempt", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    // Alternating exercise types so both the debugging and explanation axes
    // actually move — a single repeated type leaves one axis at 0 forever,
    // which caps overall well short of 85 (knowledge/application/debugging
    // alone can only reach 0.25+0.3+0.2 = 75% of the weighted total).
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.attempts.recordAttempt, {
        userId,
        exerciseId,
        topicId,
        ...attemptArgs({ exerciseType: i % 2 === 0 ? "debugging" : "explain_code" }),
      });
    }

    const progress = await t.run((ctx) =>
      ctx.db
        .query("topicProgress")
        .withIndex("by_user_and_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
        .unique()
    );
    expect(progress?.status).toBe("mastered");

    const achievements = await t.query(api.achievements.listAchievements, { userId });
    const masteryAwards = achievements.filter((a) => a.key === "first_mastery");
    expect(masteryAwards).toHaveLength(1);
  });

  it("creates a mistake when feedback.detectedMisconception is set", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({
        result: "incorrect",
        feedback: {
          ...BASE_FEEDBACK,
          detectedMisconception: "Off-by-one in loop bound",
          detectedMisconceptionKey: "off-by-one-loop-bound",
        },
      }),
    });

    const mistakes = await t.query(api.mistakes.listOpenMistakes, { userId });
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]!.description).toBe("Off-by-one in loop bound");
  });

  it("awards 100 XP for a clean correct attempt (no hints, no reveal)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ result: "correct", hintsUsed: 0, solutionRevealed: false }),
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.totalXp).toBe(100);
  });

  it("awards only 40 XP for a correct attempt that used hints", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ result: "correct", hintsUsed: 2, solutionRevealed: false }),
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.totalXp).toBe(40);
  });

  it("awards 15 XP for a partially correct attempt and 0 for incorrect", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ result: "partially_correct" }),
    });
    let user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.totalXp).toBe(15);

    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ result: "incorrect" }),
    });
    user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.totalXp).toBe(15); // unchanged
  });

  it("awards firstWin on the first-ever correct attempt", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ result: "correct" }),
    });

    const achievements = await t.query(api.achievements.listAchievements, { userId });
    expect(achievements.map((a) => a.key)).toContain("first_win");
  });

  it("awards perfectFive after 5 consecutive clean (no-hint, non-revealed) correct attempts", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    for (let i = 0; i < 5; i++) {
      await t.mutation(api.attempts.recordAttempt, {
        userId,
        exerciseId,
        topicId,
        ...attemptArgs({ result: "correct", hintsUsed: 0, solutionRevealed: false }),
      });
    }

    const achievements = await t.query(api.achievements.listAchievements, { userId });
    expect(achievements.map((a) => a.key)).toContain("perfect_five");
  });

  it("resets the no-hint streak when a hint is used, so perfectFive doesn't fire", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    for (let i = 0; i < 4; i++) {
      await t.mutation(api.attempts.recordAttempt, {
        userId,
        exerciseId,
        topicId,
        ...attemptArgs({ result: "correct", hintsUsed: 0, solutionRevealed: false }),
      });
    }
    // Breaks the streak.
    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ result: "correct", hintsUsed: 1, solutionRevealed: false }),
    });

    const achievements = await t.query(api.achievements.listAchievements, { userId });
    expect(achievements.map((a) => a.key)).not.toContain("perfect_five");
  });
});

describe("listAttemptsForTopic", () => {
  it("returns attempts newest first", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const exerciseId = await seedExercise(t, userId, topicId);

    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ submittedAnswer: "first" }),
    });
    await t.mutation(api.attempts.recordAttempt, {
      userId,
      exerciseId,
      topicId,
      ...attemptArgs({ submittedAnswer: "second" }),
    });

    const attempts = await t.query(api.attempts.listAttemptsForTopic, { userId, topicId });
    expect(attempts.map((a) => a.submittedAnswer)).toEqual(["second", "first"]);
  });
});
