import type { AttemptReward } from "@/types/domain";

/**
 * A running record of one practice round, used to build the completion
 * summary ("3 of 5 correct, +240 XP, mastery 42% → 58%"). Pure and
 * serialisable so it can live in React state and in the resume snapshot.
 */

export type RoundResult = "correct" | "partially_correct" | "incorrect";

export interface RoundEntry {
  exerciseId: string;
  title: string;
  /** The latest verdict - a revised resubmission replaces the earlier one. */
  result: RoundResult;
  /** XP summed over every submission of this exercise. */
  xp: number;
}

export interface RoundLog {
  entries: RoundEntry[];
  /** Topic mastery before the round's first submission / after the latest one; null until something is submitted. */
  masteryStart: number | null;
  masteryNow: number | null;
  /** Achievement keys unlocked during the round. */
  achievements: string[];
  /** Misconceptions the reviewer flagged (deduplicated, in order of appearance). */
  misconceptions: string[];
}

export const EMPTY_ROUND_LOG: RoundLog = {
  entries: [],
  masteryStart: null,
  masteryNow: null,
  achievements: [],
  misconceptions: [],
};

export function recordAttemptInLog(
  log: RoundLog,
  attempt: {
    exerciseId: string;
    title: string;
    result: RoundResult;
    reward: AttemptReward | null;
    misconception: string | null;
  }
): RoundLog {
  const xp = attempt.reward?.xpAwarded ?? 0;
  const existing = log.entries.find((e) => e.exerciseId === attempt.exerciseId);

  const entries = existing
    ? log.entries.map((e) =>
        e.exerciseId === attempt.exerciseId ? { ...e, result: attempt.result, xp: e.xp + xp } : e
      )
    : [...log.entries, { exerciseId: attempt.exerciseId, title: attempt.title, result: attempt.result, xp }];

  const union = (current: string[], additions: string[]) => [
    ...current,
    ...additions.filter((a, i) => !current.includes(a) && additions.indexOf(a) === i),
  ];

  return {
    entries,
    masteryStart: log.masteryStart ?? attempt.reward?.masteryBefore ?? null,
    masteryNow: attempt.reward?.masteryAfter ?? log.masteryNow,
    achievements: union(log.achievements, attempt.reward?.newAchievements ?? []),
    misconceptions: union(log.misconceptions, attempt.misconception ? [attempt.misconception] : []),
  };
}

export function roundTotals(log: RoundLog) {
  return {
    correct: log.entries.filter((e) => e.result === "correct").length,
    total: log.entries.length,
    xp: log.entries.reduce((sum, e) => sum + e.xp, 0),
  };
}
