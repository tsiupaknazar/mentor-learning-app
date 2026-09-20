import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test.helpers";

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

/** A finished session on a topic - what "having learned it" means (only a Learn session counts). */
async function seedFinishedSession(
  t: ReturnType<typeof convexTest>,
  userId: string,
  topicId: string,
  mode: "learn" | "practice" | undefined = "learn"
) {
  await t.run((ctx) =>
    ctx.db.insert("sessions", {
      userId: userId as never,
      topicId: topicId as never,
      objective: "o",
      startedAt: Date.now() - 60_000,
      completedAt: Date.now(),
      exercisesPlanned: 5,
      exercisesCompleted: 5,
      mode,
    })
  );
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
  it("prioritizes a due review of a topic the learner has learned over the next step", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { learningPathId } = await seedPathWithTopic(
      t,
      userId,
      { externalId: "in-progress", title: "In Progress Topic" },
      { status: "in_progress" }
    );
    const due = await seedPathWithTopic(
      t,
      userId,
      { externalId: "due-review", title: "Due Review Topic" },
      { status: "needs_review", nextReviewDue: Date.now() - 1000 },
      learningPathId
    );
    await seedFinishedSession(t, userId, due.topicId); // learned, so it can come up for review

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
    const { learningPathId } = await seedPathWithTopic(
      t,
      userId,
      { externalId: "a" },
      { mastery: { knowledge: 100, application: 100, debugging: 100, explanation: 100, retention: 100, overall: 100 } }
    );
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "b" },
      { mastery: { knowledge: 0, application: 0, debugging: 0, explanation: 0, retention: 0, overall: 0 } },
      learningPathId
    );

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.overallMastery).toBe(50);
  });
});

describe("getDashboardSummary next action: path scoping, locks and order", () => {
  const FRESH = { status: "not_started", attemptsCount: 0 };

  async function deactivate(t: ReturnType<typeof convexTest>, learningPathId: string) {
    await t.run((ctx) => ctx.db.patch(learningPathId as never, { isActive: false }));
  }

  it("ignores in-progress work from an earlier, inactive path and points at the active path instead", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const old = await seedPathWithTopic(t, userId, { externalId: "old", title: "Old Topic" }, { status: "in_progress" });
    await deactivate(t, old.learningPathId);
    await seedPathWithTopic(t, userId, { externalId: "fresh", title: "Fresh Topic" }, FRESH);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    // Previously the old path's topic won the lookup, wasn't found in the active
    // path, and nextAction came back null ("no active path").
    expect(summary?.nextAction).toMatchObject({ kind: "start", topicTitle: "Fresh Topic" });
  });

  it("ignores a due review from an earlier, inactive path", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const old = await seedPathWithTopic(
      t,
      userId,
      { externalId: "old", title: "Old Topic" },
      { status: "needs_review", nextReviewDue: Date.now() - 1000 }
    );
    await deactivate(t, old.learningPathId);
    await seedPathWithTopic(t, userId, { externalId: "fresh", title: "Fresh Topic" }, FRESH);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.nextAction).toMatchObject({ kind: "start", topicTitle: "Fresh Topic" });
  });

  it("starts the first step, not a later topic that names it as a prerequisite", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { learningPathId } = await seedPathWithTopic(
      t,
      userId,
      { externalId: "basics", title: "Basics", orderIndex: 0 },
      FRESH
    );
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "advanced", title: "Advanced", prerequisiteExternalIds: ["basics"], orderIndex: 1 },
      FRESH,
      learningPathId
    );

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.nextAction).toMatchObject({ kind: "start", topicTitle: "Basics" });
  });

  it("ignores a prerequisite that points at a LATER topic - it can never be met first and would strand the path", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { learningPathId } = await seedPathWithTopic(
      t,
      userId,
      { externalId: "advanced", title: "Advanced", prerequisiteExternalIds: ["basics"], orderIndex: 0 },
      FRESH
    );
    await seedPathWithTopic(t, userId, { externalId: "basics", title: "Basics", orderIndex: 1 }, FRESH, learningPathId);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.nextAction).toMatchObject({ kind: "start", topicTitle: "Advanced" });
  });

  it("does not offer to continue a topic that has become locked again", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { learningPathId } = await seedPathWithTopic(
      t,
      userId,
      { externalId: "advanced", title: "Advanced", prerequisiteExternalIds: ["basics"], orderIndex: 1 },
      { status: "in_progress" }
    );
    // Prerequisite slipped back to needs_review (a failed attempt), so "advanced" is locked again.
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "basics", title: "Basics", orderIndex: 0 },
      { status: "needs_review" },
      learningPathId
    );

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.nextAction).toMatchObject({ kind: "continue", topicTitle: "Basics" });
  });

  it("starts the first topic in learning-path order, not database insertion order", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { learningPathId } = await seedPathWithTopic(
      t,
      userId,
      { externalId: "second", title: "Second", orderIndex: 1 },
      FRESH
    );
    await seedPathWithTopic(t, userId, { externalId: "first", title: "First", orderIndex: 0 }, FRESH, learningPathId);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.nextAction?.topicTitle).toBe("First");
  });

  it("visits a parent topic before its children, then the next root", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const root2 = await seedPathWithTopic(t, userId, { externalId: "root2", title: "Root 2", orderIndex: 1 }, FRESH);
    const root1 = await seedPathWithTopic(
      t,
      userId,
      { externalId: "root1", title: "Root 1", orderIndex: 0 },
      { status: "mastered", attemptsCount: 3 },
      root2.learningPathId
    );
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "child", title: "Child of Root 1", orderIndex: 0, parentTopicId: root1.topicId },
      FRESH,
      root2.learningPathId
    );

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    // Root 1 is mastered; its child comes before Root 2 in tree order.
    expect(summary?.nextAction?.topicTitle).toBe("Child of Root 1");
  });

  it("counts mastered topics and overall mastery for the active path only", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const full = { knowledge: 100, application: 100, debugging: 100, explanation: 100, retention: 100, overall: 100 };
    const old = await seedPathWithTopic(t, userId, { externalId: "old" }, { status: "mastered", mastery: full });
    await deactivate(t, old.learningPathId);
    await seedPathWithTopic(t, userId, { externalId: "fresh" }, FRESH);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.topicsCount).toBe(1);
    expect(summary?.topicsMastered).toBe(0); // was 1/1 mastered via the old path
    expect(summary?.overallMastery).toBe(0);
  });
});

describe("getDashboardSummary reviewsDue", () => {
  const past = () => Date.now() - 1000;

  it("counts the due topics of the active path, excluding locked, mastered and other-path ones", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const due = { status: "needs_review", nextReviewDue: past() };

    const old = await seedPathWithTopic(t, userId, { externalId: "old" }, due);
    await t.run((ctx) => ctx.db.patch(old.learningPathId as never, { isActive: false }));

    const a = await seedPathWithTopic(t, userId, { externalId: "a", title: "A", orderIndex: 0 }, due);
    const learningPathId = a.learningPathId;
    const b = await seedPathWithTopic(t, userId, { externalId: "b", title: "B", orderIndex: 1 }, due, learningPathId);
    await seedFinishedSession(t, userId, a.topicId);
    await seedFinishedSession(t, userId, b.topicId);
    // Due, but only ever practised - never learned - so not a review yet.
    await seedPathWithTopic(t, userId, { externalId: "drilled", title: "Drilled", orderIndex: 7 }, due, learningPathId);
    await seedPathWithTopic(t, userId, { externalId: "done", orderIndex: 2 }, { status: "mastered", nextReviewDue: past() }, learningPathId);
    await seedPathWithTopic(
      t,
      userId,
      { externalId: "gated", orderIndex: 3, prerequisiteExternalIds: ["never-mastered"] },
      due,
      learningPathId
    );
    await seedPathWithTopic(t, userId, { externalId: "never-mastered", orderIndex: 4 }, { status: "in_progress" }, learningPathId);
    await seedPathWithTopic(t, userId, { externalId: "later", orderIndex: 5 }, { status: "needs_review", nextReviewDue: Date.now() + 86_400_000 }, learningPathId);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.reviewsDue).toBe(2); // A and B only
    expect(summary?.nextAction?.kind).toBe("review");
  });

  it("is zero when nothing is due", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await seedPathWithTopic(t, userId, { externalId: "fresh" }, { status: "not_started", attemptsCount: 0 });

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });
    expect(summary?.reviewsDue).toBe(0);
  });
});

describe("practising ahead never changes what's next (HTML/CSS path)", () => {
  const NEW = { status: "not_started", attemptsCount: 0 };
  // Flexbox was drilled in Practice: attempts and a weak in-progress mastery, but never learned.
  const DRILLED = {
    status: "in_progress",
    attemptsCount: 4,
    mastery: { knowledge: 30, application: 30, debugging: 0, explanation: 0, retention: 10, overall: 25 },
  };

  async function htmlCssPath(level: "beginner" | "junior") {
    const t = convexTest(schema);
    const userId = await seedUser(t, { level });
    const html = await seedPathWithTopic(t, userId, { externalId: "html", title: "HTML structure and semantics", orderIndex: 0 }, NEW);
    const at = html.learningPathId;
    const selectors = await seedPathWithTopic(t, userId, { externalId: "selectors", title: "CSS selectors", orderIndex: 1 }, NEW, at);
    const flexbox = await seedPathWithTopic(t, userId, { externalId: "flexbox", title: "Flexbox", orderIndex: 2 }, DRILLED, at);
    return { t, userId, html, selectors, flexbox };
  }

  for (const level of ["beginner", "junior"] as const) {
    it(`${level}: after drilling Flexbox, the first step is still HTML structure, not "continue Flexbox"`, async () => {
      const { t, userId } = await htmlCssPath(level);

      const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

      expect(summary?.nextAction).toMatchObject({ kind: "start", topicTitle: "HTML structure and semantics" });
    });
  }

  it("moves on to the next topic only when the current one is passed by learning it", async () => {
    const { t, userId, html } = await htmlCssPath("beginner");
    await seedFinishedSession(t, userId, html.topicId);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.nextAction).toMatchObject({ kind: "start", topicTitle: "CSS selectors" });
  });

  it("does not count a finished PRACTICE drill as having learned the topic", async () => {
    const { t, userId, html } = await htmlCssPath("beginner");
    await seedFinishedSession(t, userId, html.topicId, "practice");

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.nextAction?.topicTitle).toBe("HTML structure and semantics");
  });

  it("counts sessions from before modes were recorded as learned, so nobody's progress is taken away", async () => {
    const { t, userId, html } = await htmlCssPath("beginner");
    await seedFinishedSession(t, userId, html.topicId, undefined);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.nextAction?.topicTitle).toBe("CSS selectors");
  });

  it("an unfinished Learn session doesn't pass a topic - the dashboard says continue it", async () => {
    const { t, userId, html } = await htmlCssPath("beginner");
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("topicProgress")
        .withIndex("by_user_and_topic", (q) => q.eq("userId", userId as never).eq("topicId", html.topicId as never))
        .unique();
      await ctx.db.patch(progress!._id, { status: "in_progress", attemptsCount: 2 });
      await ctx.db.insert("sessions", {
        userId: userId as never,
        topicId: html.topicId as never,
        objective: "o",
        startedAt: Date.now(),
        exercisesPlanned: 5,
        exercisesCompleted: 2,
        mode: "learn",
      });
    });

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.nextAction).toMatchObject({ kind: "continue", topicTitle: "HTML structure and semantics" });
  });

  it("a later topic that was genuinely mastered is skipped, once the learner is free to work on it", async () => {
    const { t, userId, html, flexbox } = await htmlCssPath("junior");
    await seedFinishedSession(t, userId, html.topicId);
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("topicProgress")
        .withIndex("by_user_and_topic", (q) => q.eq("userId", userId as never).eq("topicId", flexbox.topicId as never))
        .unique();
      await ctx.db.patch(progress!._id, { status: "mastered" });
    });

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.nextAction?.topicTitle).toBe("CSS selectors"); // not Flexbox: done; not HTML: done
  });

  it("free-form practice topics are a sandbox: never the next step, and not counted in the path", async () => {
    const { t, userId, html } = await htmlCssPath("junior");
    const custom = await t.mutation(api.learningPaths.findOrCreateAdHocTopic, { userId, title: "CSS Grid layouts" });
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("topicProgress")
        .withIndex("by_user_and_topic", (q) => q.eq("userId", userId as never).eq("topicId", custom))
        .unique();
      await ctx.db.patch(progress!._id, { status: "in_progress", attemptsCount: 9 });
    });
    await seedFinishedSession(t, userId, html.topicId);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.nextAction?.topicTitle).toBe("CSS selectors");
    expect(summary?.topicsCount).toBe(3); // the three path topics, not four
  });

  it("reports the path as complete, with no next step, once every topic is passed", async () => {
    const { t, userId, html, selectors, flexbox } = await htmlCssPath("beginner");
    for (const topic of [html, selectors, flexbox]) await seedFinishedSession(t, userId, topic.topicId);

    const summary = await t.query(api.dashboard.getDashboardSummary, { userId });

    expect(summary?.nextAction).toBeNull();
    expect(summary?.pathComplete).toBe(true);
  });

  it("is not 'complete' while there are still steps left, or when there is no path at all", async () => {
    const { t, userId } = await htmlCssPath("beginner");
    expect((await t.query(api.dashboard.getDashboardSummary, { userId }))?.pathComplete).toBe(false);

    const empty = convexTest(schema);
    const lonely = await seedUser(empty);
    expect((await empty.query(api.dashboard.getDashboardSummary, { userId: lonely }))?.pathComplete).toBe(false);
  });
});
