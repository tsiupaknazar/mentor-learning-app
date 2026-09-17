import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { seedUser, seedTopic } from "./test-helpers";

async function insertAttemptId(t: ReturnType<typeof convexTest>, userId: string, topicId: string) {
  return t.run(async (ctx) => {
    const exerciseId = await ctx.db.insert("exercises", {
      userId: userId as never,
      topicId: topicId as never,
      externalId: "ex1",
      subtopic: "closures",
      type: "debugging",
      difficulty: "medium",
      language: "javascript",
      title: "t",
      prompt: "p",
      referenceSolution: "r",
      createdAt: Date.now(),
    });
    return ctx.db.insert("attempts", {
      userId: userId as never,
      exerciseId,
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
}

describe("upsertMistake", () => {
  it("creates a new mistake on first detection", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const attemptId = await insertAttemptId(t, userId, topicId);

    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Off-by-one",
      attemptId,
      key: "off-by-one",
    });

    const mistakes = await t.query(api.mistakes.listOpenMistakes, { userId });
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]!.occurrences).toBe(1);
    expect(mistakes[0]!.status).toBe("open");
  });

  it("matches a recurrence by key even when the description wording differs", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const attemptId1 = await insertAttemptId(t, userId, topicId);
    const attemptId2 = await insertAttemptId(t, userId, topicId);

    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Off-by-one in the loop",
      attemptId: attemptId1,
      key: "off-by-one-loop-bound",
    });
    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Completely different wording in another locale",
      attemptId: attemptId2,
      key: "off-by-one-loop-bound",
    });

    const mistakes = await t.query(api.mistakes.listOpenMistakes, { userId });
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]!.occurrences).toBe(2);
  });

  it("falls back to matching by description when either side lacks a key", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const attemptId1 = await insertAttemptId(t, userId, topicId);
    const attemptId2 = await insertAttemptId(t, userId, topicId);

    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Missing await",
      attemptId: attemptId1,
    });
    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Missing await",
      attemptId: attemptId2,
    });

    const mistakes = await t.query(api.mistakes.listOpenMistakes, { userId });
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]!.occurrences).toBe(2);
  });

  it("reopens to needs_review once occurrences reach 3", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    for (let i = 0; i < 3; i++) {
      const attemptId = await insertAttemptId(t, userId, topicId);
      await t.mutation(internal.mistakes.upsertMistake, {
        userId,
        topicId,
        description: "Off-by-one",
        attemptId,
        key: "off-by-one",
      });
    }

    const mistakes = await t.query(api.mistakes.listOpenMistakes, { userId });
    expect(mistakes[0]!.status).toBe("needs_review");
  });
});

describe("advanceResolutionProgress", () => {
  it("does nothing when the attempt was not clean", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const attemptId = await insertAttemptId(t, userId, topicId);
    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Off-by-one",
      attemptId,
      key: "off-by-one",
    });

    await t.mutation(internal.mistakes.advanceResolutionProgress, {
      userId,
      topicId,
      wasClean: false,
    });

    const mistakes = await t.query(api.mistakes.listOpenMistakes, { userId });
    expect(mistakes[0]!.consecutiveCleanAttempts ?? 0).toBe(0);
  });

  it("auto-resolves a mistake after RESOLVE_THRESHOLD clean attempts, awarding mistakeSlayer at the 5th resolution", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);

    // Create and then resolve 5 distinct mistakes to cross the slayer threshold.
    for (let m = 0; m < 5; m++) {
      const attemptId = await insertAttemptId(t, userId, topicId);
      const key = `mistake-${m}`;
      await t.mutation(internal.mistakes.upsertMistake, {
        userId,
        topicId,
        description: `Mistake ${m}`,
        attemptId,
        key,
      });
      for (let i = 0; i < 3; i++) {
        await t.mutation(internal.mistakes.advanceResolutionProgress, {
          userId,
          topicId,
          wasClean: true,
        });
      }
    }

    const resolved = await t.query(api.mistakes.listResolvedMistakes, { userId, limit: 10 });
    expect(resolved).toHaveLength(5);

    const achievements = await t.query(api.achievements.listAchievements, { userId });
    expect(achievements.map((a) => a.key)).toContain("mistake_slayer");
  });

  it("excludes the just-recurred mistake from the clean-attempt increment", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const attemptId = await insertAttemptId(t, userId, topicId);
    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Off-by-one",
      attemptId,
      key: "off-by-one",
    });

    await t.mutation(internal.mistakes.advanceResolutionProgress, {
      userId,
      topicId,
      wasClean: true,
      recurredKey: "off-by-one",
    });

    const mistakes = await t.query(api.mistakes.listOpenMistakes, { userId });
    expect(mistakes[0]!.consecutiveCleanAttempts ?? 0).toBe(0);
  });
});

describe("markMistakeResolved", () => {
  it("resolves the mistake for its own owner", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { topicId } = await seedTopic(t, userId);
    const attemptId = await insertAttemptId(t, userId, topicId);
    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Off-by-one",
      attemptId,
      key: "off-by-one",
    });
    const [mistake] = await t.query(api.mistakes.listOpenMistakes, { userId });

    await t.mutation(api.mistakes.markMistakeResolved, { userId, mistakeId: mistake!._id });

    const resolved = await t.query(api.mistakes.listResolvedMistakes, { userId });
    expect(resolved).toHaveLength(1);
  });

  it("refuses to resolve a mistake belonging to a different user", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const otherUserId = await seedUser(t, { clerkId: "clerk_other", email: "other@example.com" });
    const { topicId } = await seedTopic(t, userId);
    const attemptId = await insertAttemptId(t, userId, topicId);
    await t.mutation(internal.mistakes.upsertMistake, {
      userId,
      topicId,
      description: "Off-by-one",
      attemptId,
      key: "off-by-one",
    });
    const [mistake] = await t.query(api.mistakes.listOpenMistakes, { userId });

    await expect(
      t.mutation(api.mistakes.markMistakeResolved, { userId: otherUserId, mistakeId: mistake!._id })
    ).rejects.toThrow();
  });
});
