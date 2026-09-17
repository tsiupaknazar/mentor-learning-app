import { convexTest } from "convex-test";
import { describe, expect, it, vi, afterEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test-helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("getOrCreateUser", () => {
  it("creates a new user with onboarding defaults", async () => {
    const t = convexTest(schema);

    const userId = await t.mutation(api.users.getOrCreateUser, {
      clerkId: "clerk_1",
      email: "a@example.com",
      displayName: "A",
    });

    const user = await t.query(api.users.getCurrentUser, { clerkId: "clerk_1" });
    expect(user?._id).toBe(userId);
    expect(user?.onboardingComplete).toBe(false);
    expect(user?.totalXp).toBe(0);
  });

  it("is idempotent: a second call with the same clerkId returns the existing user", async () => {
    const t = convexTest(schema);

    const first = await t.mutation(api.users.getOrCreateUser, {
      clerkId: "clerk_1",
      email: "a@example.com",
      displayName: "A",
    });
    const second = await t.mutation(api.users.getOrCreateUser, {
      clerkId: "clerk_1",
      email: "a@example.com",
      displayName: "A",
    });

    expect(second).toBe(first);
    const all = await t.run((ctx) => ctx.db.query("users").collect());
    expect(all).toHaveLength(1);
  });
});

describe("completeOnboarding", () => {
  it("sets the onboarding fields and flips onboardingComplete", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, { onboardingComplete: false });

    await t.mutation(api.users.completeOnboarding, {
      userId,
      level: "intermediate",
      learningGoal: "first_job",
      learningStyle: "more_practice",
      dailyTime: "1hr",
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.onboardingComplete).toBe(true);
    expect(user?.level).toBe("intermediate");
  });
});

describe("updatePreferences", () => {
  it("only patches fields that are actually provided", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, { learningGoal: "improve_skills", locale: "en" });

    await t.mutation(api.users.updatePreferences, { userId, locale: "uk" });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.locale).toBe("uk");
    expect(user?.learningGoal).toBe("improve_skills"); // untouched
  });
});

describe("awardXp", () => {
  it("adds XP to the user's total", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, { totalXp: 10 });

    await t.mutation(api.users.awardXp, { userId, amount: 40 });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.totalXp).toBe(50);
  });
});

describe("recordActivity (daily streak)", () => {
  it("starts the streak at 1 on the first-ever activity", async () => {
    const t = convexTest(schema);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-10T12:00:00Z"));
    const userId = await seedUser(t, { currentStreak: 0, longestStreak: 0, lastActiveDate: "" });

    await t.mutation(api.users.recordActivity, { userId });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.currentStreak).toBe(1);
    expect(user?.lastActiveDate).toBe("2024-06-10");
  });

  it("is a no-op the second time it's called on the same day", async () => {
    const t = convexTest(schema);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-10T09:00:00Z"));
    const userId = await seedUser(t, { currentStreak: 1, longestStreak: 1, lastActiveDate: "2024-06-10" });

    vi.setSystemTime(new Date("2024-06-10T20:00:00Z"));
    await t.mutation(api.users.recordActivity, { userId });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.currentStreak).toBe(1);
  });

  it("continues the streak when the last activity was yesterday", async () => {
    const t = convexTest(schema);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-10T12:00:00Z"));
    const userId = await seedUser(t, { currentStreak: 3, longestStreak: 3, lastActiveDate: "2024-06-09" });

    await t.mutation(api.users.recordActivity, { userId });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.currentStreak).toBe(4);
    expect(user?.longestStreak).toBe(4);
  });

  it("resets the streak to 1 when a day was missed", async () => {
    const t = convexTest(schema);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-10T12:00:00Z"));
    const userId = await seedUser(t, { currentStreak: 5, longestStreak: 5, lastActiveDate: "2024-06-01" });

    await t.mutation(api.users.recordActivity, { userId });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.currentStreak).toBe(1);
    expect(user?.longestStreak).toBe(5); // longest is preserved, not reset
  });

  it("awards streak milestone achievements at 7 and 30 days", async () => {
    const t = convexTest(schema);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-10T12:00:00Z"));
    const userId = await seedUser(t, { currentStreak: 6, longestStreak: 6, lastActiveDate: "2024-06-09" });

    await t.mutation(api.users.recordActivity, { userId });

    const achievements = await t.query(api.achievements.listAchievements, { userId });
    expect(achievements.map((a) => a.key)).toContain("streak_7");
  });
});
