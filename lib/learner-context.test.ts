import { describe, expect, it, vi, beforeEach } from "vitest";

const { convexQueryMock } = vi.hoisted(() => ({ convexQueryMock: vi.fn() }));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock }));

import { getLearnerContext } from "@/lib/learner-context";

beforeEach(() => {
  convexQueryMock.mockReset();
});

describe("getLearnerContext", () => {
  it("throws when the Convex query resolves falsy", async () => {
    convexQueryMock.mockResolvedValue(null);
    await expect(getLearnerContext("user1" as never)).rejects.toThrow(
      "No learner context available"
    );
  });

  it("maps the raw result, defaulting a missing pathSubject to null", async () => {
    convexQueryMock.mockResolvedValue({
      level: "junior",
      learningGoal: "improve_skills",
      learningStyle: "balanced",
      locale: "en",
      currentTopics: ["Closures"],
      weakTopics: [],
      strongTopics: [],
      recurringMistakes: [],
      recentPerformance: 80,
      // pathSubject omitted
    });

    const ctx = await getLearnerContext("user1" as never);

    expect(ctx.pathSubject).toBeNull();
    expect(ctx.currentTopics).toEqual(["Closures"]);
    expect(ctx.recentPerformance).toBe(80);
  });

  it("passes through an explicit pathSubject unchanged", async () => {
    convexQueryMock.mockResolvedValue({
      level: "junior",
      learningGoal: "improve_skills",
      learningStyle: "balanced",
      locale: "en",
      currentTopics: [],
      weakTopics: [],
      strongTopics: [],
      recurringMistakes: [],
      recentPerformance: 0,
      pathSubject: "JavaScript",
    });

    const ctx = await getLearnerContext("user1" as never);

    expect(ctx.pathSubject).toBe("JavaScript");
  });
});
