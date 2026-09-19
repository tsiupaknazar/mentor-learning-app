/**
 * Lays a learner's per-day activity out as a calendar grid: one column per
 * week (Monday first), one row per weekday, ending with the week that
 * contains today. Pure - the caller supplies "today" - so it is deterministic
 * and unit-testable. All dates are UTC `YYYY-MM-DD`, matching how the server
 * buckets attempts and counts streaks.
 */

export interface ActivityDay {
  date: string;
  count: number;
}

export interface ActivityCell {
  date: string;
  count: number;
  /** 0 = no activity ... 4 = the busiest bucket. */
  level: 0 | 1 | 2 | 3 | 4;
  /** After today: shown as an empty slot, never as "no activity". */
  future: boolean;
}

export interface ActivityGrid {
  weeks: ActivityCell[][];
  total: number;
  activeDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const startOfUtcDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function activityLevel(count: number): ActivityCell["level"] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** How many days back from today (inclusive) a grid of `weeks` columns can reach: enough to fetch for it. */
export const activityDaysNeeded = (weeks: number) => weeks * 7;

export function buildActivityGrid(days: ActivityDay[], todayIso: string, weeks = 12): ActivityGrid {
  const countByDate = new Map(days.map((d) => [d.date, d.count]));
  const today = startOfUtcDay(todayIso);
  const weekdayMonFirst = (new Date(today).getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  const firstMonday = today - weekdayMonFirst * DAY_MS - (weeks - 1) * 7 * DAY_MS;

  let total = 0;
  let activeDays = 0;
  const grid: ActivityCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: ActivityCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = toIso(firstMonday + (w * 7 + d) * DAY_MS);
      const future = startOfUtcDay(date) > today;
      const count = future ? 0 : (countByDate.get(date) ?? 0);
      if (count > 0) {
        total += count;
        activeDays += 1;
      }
      column.push({ date, count, level: activityLevel(count), future });
    }
    grid.push(column);
  }
  return { weeks: grid, total, activeDays };
}
