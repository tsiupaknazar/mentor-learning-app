import { describe, expect, it } from "vitest";
import { EMPTY_ROUND_LOG, recordAttemptInLog, roundTotals } from "./round-log";

const reward = (over: Partial<{ xpAwarded: number; masteryBefore: number; masteryAfter: number; newAchievements: string[] }> = {}) => ({
  xpAwarded: 100,
  masteryBefore: 40,
  masteryAfter: 48,
  newAchievements: [],
  ...over,
});

const attempt = (over = {}) => ({
  exerciseId: "e1",
  title: "First",
  result: "correct" as const,
  reward: reward(),
  misconception: null,
  ...over,
});

describe("round log", () => {
  it("starts empty", () => {
    expect(roundTotals(EMPTY_ROUND_LOG)).toEqual({ correct: 0, total: 0, xp: 0 });
  });

  it("records an entry and seeds mastery start/now from the first reward", () => {
    const log = recordAttemptInLog(EMPTY_ROUND_LOG, attempt());
    expect(log.entries).toEqual([{ exerciseId: "e1", title: "First", result: "correct", xp: 100 }]);
    expect(log.masteryStart).toBe(40);
    expect(log.masteryNow).toBe(48);
  });

  it("keeps the first masteryStart and follows the latest masteryAfter", () => {
    let log = recordAttemptInLog(EMPTY_ROUND_LOG, attempt());
    log = recordAttemptInLog(log, attempt({ exerciseId: "e2", title: "Second", reward: reward({ masteryBefore: 48, masteryAfter: 55 }) }));
    expect(log.masteryStart).toBe(40);
    expect(log.masteryNow).toBe(55);
  });

  it("merges a revised resubmission into one entry: latest result, XP summed", () => {
    let log = recordAttemptInLog(EMPTY_ROUND_LOG, attempt({ result: "incorrect", reward: reward({ xpAwarded: 0 }) }));
    log = recordAttemptInLog(log, attempt({ result: "correct", reward: reward({ xpAwarded: 40 }) }));
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]).toMatchObject({ result: "correct", xp: 40 });
    expect(roundTotals(log)).toEqual({ correct: 1, total: 1, xp: 40 });
  });

  it("deduplicates achievements and misconceptions", () => {
    let log = recordAttemptInLog(EMPTY_ROUND_LOG, attempt({ reward: reward({ newAchievements: ["first_win", "first_win"] }), misconception: "off by one" }));
    log = recordAttemptInLog(log, attempt({ exerciseId: "e2", reward: reward({ newAchievements: ["first_win", "xp_500"] }), misconception: "off by one" }));
    expect(log.achievements).toEqual(["first_win", "xp_500"]);
    expect(log.misconceptions).toEqual(["off by one"]);
  });

  it("tolerates a missing reward (older server response) without losing the entry", () => {
    const log = recordAttemptInLog(EMPTY_ROUND_LOG, attempt({ reward: null }));
    expect(log.entries[0]).toMatchObject({ result: "correct", xp: 0 });
    expect(log.masteryStart).toBeNull();
  });

  it("counts only fully correct entries as correct", () => {
    let log = recordAttemptInLog(EMPTY_ROUND_LOG, attempt({ exerciseId: "a", result: "correct" }));
    log = recordAttemptInLog(log, attempt({ exerciseId: "b", result: "partially_correct" }));
    log = recordAttemptInLog(log, attempt({ exerciseId: "c", result: "incorrect" }));
    expect(roundTotals(log)).toMatchObject({ correct: 1, total: 3 });
  });
});
