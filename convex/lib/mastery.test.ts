import { describe, expect, it } from "vitest";
import {
  rollingUpdate,
  updateMasteryFromAttempt,
  nextReviewDelayMs,
  EMPTY_MASTERY,
  type AttemptScores,
} from "@/convex/lib/mastery";

const PERFECT_SCORES: AttemptScores = {
  correctness: 100,
  logic: 100,
  codeQuality: 100,
  bestPractices: 100,
  edgeCaseHandling: 100,
};

describe("rollingUpdate", () => {
  it("weights the new value by the given weight", () => {
    expect(rollingUpdate(50, 100, 0.5)).toBe(75);
  });

  it("uses the default recency weight of 0.35 when not given", () => {
    expect(rollingUpdate(50, 100)).toBe(68); // 50*0.65 + 100*0.35 = 67.5 -> rounds to 68
  });

  it("clamps at 0", () => {
    expect(rollingUpdate(10, -50, 1)).toBe(0);
  });

  it("clamps at 100", () => {
    expect(rollingUpdate(90, 150, 1)).toBe(100);
  });
});

describe("updateMasteryFromAttempt", () => {
  it("always moves application and knowledge from correctness/logic/bestPractices", () => {
    const result = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "implementation", false);
    expect(result.application).toBeGreaterThan(0);
    expect(result.knowledge).toBeGreaterThan(0);
  });

  it("only moves debugging for debugging/find_the_bug exercise types", () => {
    const debugging = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "debugging", false);
    expect(debugging.debugging).toBeGreaterThan(0);

    const findTheBug = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "find_the_bug", false);
    expect(findTheBug.debugging).toBeGreaterThan(0);

    const unrelated = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "implementation", false);
    expect(unrelated.debugging).toBe(EMPTY_MASTERY.debugging);
  });

  it("only moves explanation for explain_code/review_code exercise types", () => {
    const explainCode = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "explain_code", false);
    expect(explainCode.explanation).toBeGreaterThan(0);

    const reviewCode = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "review_code", false);
    expect(reviewCode.explanation).toBeGreaterThan(0);

    const unrelated = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "implementation", false);
    expect(unrelated.explanation).toBe(EMPTY_MASTERY.explanation);
  });

  it("never moves retention on a first attempt", () => {
    const result = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "implementation", false);
    expect(result.retention).toBe(EMPTY_MASTERY.retention);
  });

  it("moves retention once the learner has attempted this topic before", () => {
    const result = updateMasteryFromAttempt(EMPTY_MASTERY, PERFECT_SCORES, "implementation", true);
    expect(result.retention).toBeGreaterThan(0);
  });

  it("computes overall as the documented weighted average", () => {
    const previous = { knowledge: 80, application: 80, debugging: 80, explanation: 80, retention: 80, overall: 80 };
    const result = updateMasteryFromAttempt(previous, PERFECT_SCORES, "implementation", true);
    const expectedOverall = Math.round(
      result.knowledge * 0.25 +
        result.application * 0.3 +
        result.debugging * 0.2 +
        result.explanation * 0.15 +
        result.retention * 0.1
    );
    expect(result.overall).toBe(expectedOverall);
  });
});

describe("nextReviewDelayMs", () => {
  const day = 24 * 60 * 60 * 1000;

  it("always schedules a 1-day review after an incorrect attempt, regardless of mastery", () => {
    expect(nextReviewDelayMs(95, false)).toBe(1 * day);
    expect(nextReviewDelayMs(0, false)).toBe(1 * day);
  });

  it("schedules progressively longer reviews as mastery increases after a correct attempt", () => {
    expect(nextReviewDelayMs(49, true)).toBe(1 * day);
    expect(nextReviewDelayMs(50, true)).toBe(3 * day);
    expect(nextReviewDelayMs(70, true)).toBe(7 * day);
    expect(nextReviewDelayMs(85, true)).toBe(14 * day);
  });
});
