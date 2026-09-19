import type { DailyTime } from "@/types/domain";

/**
 * How many exercises a practice session holds, from the learner's stated
 * daily time. A rough budget of 5-10 minutes per exercise (read, attempt,
 * get reviewed, absorb the feedback): 15 min -> 3, 30 min -> 5 (the
 * long-standing default), 1 hr -> 8, 2+ hr -> 12.
 */
const EXERCISES_BY_DAILY_TIME: Record<DailyTime, number> = {
  "15min": 3,
  "30min": 5,
  "1hr": 8,
  "2hr_plus": 12,
};

export const DEFAULT_EXERCISES_PER_SESSION = EXERCISES_BY_DAILY_TIME["30min"];

export function exercisesForDailyTime(time: DailyTime | undefined | null): number {
  return (time && EXERCISES_BY_DAILY_TIME[time]) || DEFAULT_EXERCISES_PER_SESSION;
}
