import { describe, expect, it } from "vitest";
import { DEFAULT_EXERCISES_PER_SESSION, exercisesForDailyTime } from "./session-length";

describe("exercisesForDailyTime", () => {
  it("scales the session with the time the learner has", () => {
    expect(exercisesForDailyTime("15min")).toBe(3);
    expect(exercisesForDailyTime("30min")).toBe(5);
    expect(exercisesForDailyTime("1hr")).toBe(8);
    expect(exercisesForDailyTime("2hr_plus")).toBe(12);
  });

  it("never shrinks as more time is available", () => {
    const counts = (["15min", "30min", "1hr", "2hr_plus"] as const).map(exercisesForDailyTime);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
  });

  it("keeps the long-standing 5 for the default and for a missing or unrecognised value", () => {
    expect(DEFAULT_EXERCISES_PER_SESSION).toBe(5);
    expect(exercisesForDailyTime(undefined)).toBe(5);
    expect(exercisesForDailyTime(null)).toBe(5);
    expect(exercisesForDailyTime("forever" as never)).toBe(5);
  });
});
