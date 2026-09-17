import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test-helpers";

const SIMPLE_TREE = [
  {
    id: "functions",
    title: "Functions",
    summary: "Functions summary",
    prerequisiteIds: [],
    children: [
      {
        id: "closures",
        title: "Closures",
        summary: "Closures summary",
        prerequisiteIds: ["functions"],
        children: [],
      },
    ],
  },
];

describe("createLearningPath", () => {
  it("flattens the recursive tree into topics + zeroed topicProgress rows", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const learningPathId = await t.mutation(api.learningPaths.createLearningPath, {
      userId,
      topic: "JavaScript",
      title: "JS Path",
      rationale: "because",
      topics: SIMPLE_TREE,
    });

    const result = await t.query(api.learningPaths.getLearningPathWithTopics, { learningPathId });
    expect(result?.topics).toHaveLength(2);
    const closures = result?.topics.find((tp) => tp.externalId === "closures");
    expect(closures?.parentTopicId).toBeDefined();
    expect(closures?.prerequisiteExternalIds).toEqual(["functions"]);
  });

  it("deactivates any previously active path for the user", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const firstPathId = await t.mutation(api.learningPaths.createLearningPath, {
      userId,
      topic: "JavaScript",
      title: "First path",
      rationale: "r",
      topics: SIMPLE_TREE,
    });
    await t.mutation(api.learningPaths.createLearningPath, {
      userId,
      topic: "Python",
      title: "Second path",
      rationale: "r",
      topics: SIMPLE_TREE,
    });

    const paths = await t.query(api.learningPaths.listLearningPaths, { userId });
    const first = paths.find((p) => p._id === firstPathId);
    expect(first?.isActive).toBe(false);

    const active = await t.query(api.learningPaths.getActiveLearningPath, { userId });
    expect(active?.path.title).toBe("Second path");
  });
});

describe("getActiveLearningPath locking", () => {
  it("locks a topic whose prerequisite isn't mastered yet, and unlocks it once the prerequisite is mastered", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.mutation(api.learningPaths.createLearningPath, {
      userId,
      topic: "JavaScript",
      title: "JS Path",
      rationale: "r",
      topics: SIMPLE_TREE,
    });

    let active = await t.query(api.learningPaths.getActiveLearningPath, { userId });
    const closuresBefore = active?.topics.find((tp) => tp.externalId === "closures");
    expect(closuresBefore?.locked).toBe(true);

    const functionsTopic = active?.topics.find((tp) => tp.externalId === "functions");
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("topicProgress")
        .withIndex("by_user_and_topic", (q) => q.eq("userId", userId).eq("topicId", functionsTopic!._id))
        .unique();
      await ctx.db.patch(progress!._id, { status: "mastered" });
    });

    active = await t.query(api.learningPaths.getActiveLearningPath, { userId });
    const closuresAfter = active?.topics.find((tp) => tp.externalId === "closures");
    expect(closuresAfter?.locked).toBe(false);
  });
});

describe("findOrCreateAdHocTopic", () => {
  it("throws when the user has no active learning path", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    await expect(
      t.mutation(api.learningPaths.findOrCreateAdHocTopic, { userId, title: "CSS Flexbox" })
    ).rejects.toThrow("No active learning path");
  });

  it("is idempotent: calling it twice with the same title returns the same topic", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.mutation(api.learningPaths.createLearningPath, {
      userId,
      topic: "JavaScript",
      title: "JS Path",
      rationale: "r",
      topics: [],
    });

    const first = await t.mutation(api.learningPaths.findOrCreateAdHocTopic, {
      userId,
      title: "CSS Flexbox",
    });
    const second = await t.mutation(api.learningPaths.findOrCreateAdHocTopic, {
      userId,
      title: "CSS Flexbox",
    });

    expect(second).toBe(first);
  });
});

describe("getTopic", () => {
  it("returns null for a nonexistent topic", async () => {
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
      await ctx.db.delete(topicId);
      return topicId;
    });

    const result = await t.query(api.learningPaths.getTopic, { topicId: fakeId });
    expect(result).toBeNull();
  });

  it("resolves pathTopic and parentTopic for a real topic", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await t.mutation(api.learningPaths.createLearningPath, {
      userId,
      topic: "JavaScript",
      title: "JS Path",
      rationale: "r",
      topics: SIMPLE_TREE,
    });
    const active = await t.query(api.learningPaths.getActiveLearningPath, { userId });
    const closures = active!.topics.find((tp) => tp.externalId === "closures")!;

    const result = await t.query(api.learningPaths.getTopic, { topicId: closures._id });

    expect(result?.pathTopic).toBe("JavaScript");
    expect(result?.parentTopic?.title).toBe("Functions");
  });
});
