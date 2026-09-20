import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test.helpers";

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

// What the AI typically returns for an HTML/CSS path: no prerequisites on anything.
const HTML_CSS_TREE = [
  { id: "html", title: "HTML structure and semantics", summary: "Page structure.", prerequisiteIds: [], children: [] },
  { id: "selectors", title: "CSS selectors", summary: "Selecting elements.", prerequisiteIds: [], children: [] },
  { id: "flexbox", title: "Flexbox", summary: "Flex layout.", prerequisiteIds: [], children: [] },
];

async function htmlCssPath(level: "beginner" | "junior") {
  const t = convexTest(schema);
  const userId = await seedUser(t, { level });
  await t.mutation(api.learningPaths.createLearningPath, {
    userId,
    topic: "HTML/CSS",
    title: "HTML/CSS Path",
    rationale: "r",
    topics: HTML_CSS_TREE,
  });
  const active = async () => (await t.query(api.learningPaths.getActiveLearningPath, { userId }))!;
  const topic = async (externalId: string) => (await active()).topics.find((tp) => tp.externalId === externalId)!;
  const finishSession = async (externalId: string, mode: "learn" | "practice" | undefined = "learn") => {
    const topicId = (await topic(externalId))._id;
    await t.run((ctx) =>
      ctx.db.insert("sessions", {
        userId,
        topicId,
        objective: "o",
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
        exercisesPlanned: 5,
        exercisesCompleted: 5,
        mode,
      })
    );
  };
  const setStatus = async (externalId: string, status: "in_progress" | "mastered", attemptsCount = 3) => {
    const topicId = (await topic(externalId))._id;
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("topicProgress")
        .withIndex("by_user_and_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
        .unique();
      await ctx.db.patch(progress!._id, { status, attemptsCount });
    });
  };
  return { t, userId, active, topic, finishSession, setStatus };
}

describe("a beginner follows the path in order", () => {
  it("opens only the first topic - the AI gave Flexbox no prerequisites, but it is still ahead of the learner", async () => {
    const { active } = await htmlCssPath("beginner");
    const { topics, strictOrder } = await active();

    expect(strictOrder).toBe(true);
    const byId = Object.fromEntries(topics.map((tp) => [tp.externalId, tp]));
    expect(byId.html).toMatchObject({ locked: false, block: null });
    expect(byId.selectors).toMatchObject({ locked: true, block: "order", blockedBy: [byId.html!._id] });
    expect(byId.flexbox).toMatchObject({ locked: true, block: "order", blockedBy: [byId.html!._id] });
  });

  it("stays blocked no matter how much the learner has practised it (attempts don't unlock a topic)", async () => {
    const { topic, setStatus } = await htmlCssPath("beginner");
    await setStatus("flexbox", "in_progress", 12);
    expect(await topic("flexbox")).toMatchObject({ locked: true, block: "order" });
  });

  it("opens the next topic each time one is learned, always pointing at the nearest one to finish", async () => {
    const { topic, finishSession } = await htmlCssPath("beginner");

    await finishSession("html");
    expect(await topic("selectors")).toMatchObject({ locked: false, passed: false });
    const selectors = await topic("selectors");
    expect(await topic("flexbox")).toMatchObject({ locked: true, blockedBy: [selectors._id] });

    await finishSession("selectors");
    expect(await topic("flexbox")).toMatchObject({ locked: false });
  });

  it("does not open anything for a finished PRACTICE drill, but does for one recorded before modes existed", async () => {
    const drilled = await htmlCssPath("beginner");
    await drilled.finishSession("html", "practice");
    expect(await drilled.topic("selectors")).toMatchObject({ locked: true });

    const legacy = await htmlCssPath("beginner");
    await legacy.finishSession("html", undefined);
    expect(await legacy.topic("selectors")).toMatchObject({ locked: false });
  });

  it("opens the next topic when the first is mastered instead", async () => {
    const { topic, setStatus } = await htmlCssPath("beginner");
    await setStatus("html", "mastered");
    expect(await topic("selectors")).toMatchObject({ locked: false });
  });
});

describe("everyone else keeps the freedom to work in any order", () => {
  it("doesn't block topics that have no prerequisites", async () => {
    const { active } = await htmlCssPath("junior");
    const { topics, strictOrder } = await active();
    expect(strictOrder).toBe(false);
    expect(topics.every((tp) => !tp.locked)).toBe(true);
  });
});

describe("getTopic enforces the same rules (so a URL or API call can't get around them)", () => {
  it("reports a blocked topic with what to finish first, by title", async () => {
    const { t, topic } = await htmlCssPath("beginner");
    const flexbox = await topic("flexbox");
    const html = await topic("html");

    const detail = await t.query(api.learningPaths.getTopic, { topicId: flexbox._id });

    expect(detail).toMatchObject({
      locked: true,
      block: "order",
      blockedBy: [{ _id: html._id, title: "HTML structure and semantics" }],
    });
  });

  it("reports the first topic as open, and a blocked topic as open once it's reached", async () => {
    const { t, topic, finishSession } = await htmlCssPath("beginner");
    const html = await topic("html");
    expect((await t.query(api.learningPaths.getTopic, { topicId: html._id }))).toMatchObject({ locked: false, blockedBy: [] });

    await finishSession("html");
    const selectors = await topic("selectors");
    expect(await t.query(api.learningPaths.getTopic, { topicId: selectors._id })).toMatchObject({ locked: false });
  });
});

describe("free-form practice topics", () => {
  it("are flagged, sit outside the path, and are never blocked - even for a beginner", async () => {
    const { t, userId, active } = await htmlCssPath("beginner");

    const customId = await t.mutation(api.learningPaths.findOrCreateAdHocTopic, { userId, title: "CSS Grid layouts" });

    const custom = (await active()).topics.find((tp) => tp._id === customId)!;
    expect(custom).toMatchObject({ adHoc: true, locked: false, block: null });
    const detail = await t.query(api.learningPaths.getTopic, { topicId: customId });
    expect(detail?.locked).toBe(false);
  });

  it("don't disturb the order or blocking of the real path", async () => {
    const { t, userId, active } = await htmlCssPath("beginner");
    await t.mutation(api.learningPaths.findOrCreateAdHocTopic, { userId, title: "CSS Grid layouts" });

    const { topics } = await active();
    const real = topics.filter((tp) => !tp.adHoc);
    expect(real.map((tp) => [tp.externalId, tp.locked])).toEqual([
      ["html", false],
      ["selectors", true],
      ["flexbox", true],
    ]);
  });

  it("recognises ones created before the flag existed by their summary", async () => {
    const { t, userId, active } = await htmlCssPath("beginner");
    const path = (await active()).path;
    const legacyId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("topics", {
        learningPathId: path._id,
        userId,
        externalId: "old-custom",
        title: "Old custom topic",
        summary: "Practice topic: Old custom topic",
        prerequisiteExternalIds: [],
        orderIndex: 50,
      });
      return id;
    });

    const legacy = (await active()).topics.find((tp) => tp._id === legacyId)!;
    expect(legacy).toMatchObject({ adHoc: true, locked: false });
  });

  it("a title that names a topic of the path returns THAT topic, still subject to its lock", async () => {
    const { t, userId, topic } = await htmlCssPath("beginner");
    const flexbox = await topic("flexbox");

    const id = await t.mutation(api.learningPaths.findOrCreateAdHocTopic, { userId, title: "Flexbox" });

    expect(id).toBe(flexbox._id); // not a duplicate sandbox topic that would dodge the lock
    expect(await topic("flexbox")).toMatchObject({ adHoc: false, locked: true });
  });
});
