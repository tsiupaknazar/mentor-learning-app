import { describe, expect, it } from "vitest";
import { activityDaysNeeded, activityLevel, buildActivityGrid } from "./activity";

// 2024-06-12 is a Wednesday.
const WED = "2024-06-12";

describe("buildActivityGrid", () => {
  it("has one column per week, seven cells each, Monday first", () => {
    const { weeks } = buildActivityGrid([], WED, 12);
    expect(weeks).toHaveLength(12);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // Last column is this week: Monday 2024-06-10 .. Sunday 2024-06-16.
    expect(weeks[11]!.map((c) => c.date)).toEqual([
      "2024-06-10",
      "2024-06-11",
      "2024-06-12",
      "2024-06-13",
      "2024-06-14",
      "2024-06-15",
      "2024-06-16",
    ]);
  });

  it("starts on a Monday eleven weeks before this week's Monday", () => {
    const { weeks } = buildActivityGrid([], WED, 12);
    expect(weeks[0]![0]!.date).toBe("2024-03-25");
    expect(new Date("2024-03-25T00:00:00Z").getUTCDay()).toBe(1); // a Monday
  });

  it("marks the days after today as future, and never counts them as inactive", () => {
    const { weeks } = buildActivityGrid([{ date: "2024-06-14", count: 5 }], WED, 12);
    const thisWeek = weeks[11]!;
    expect(thisWeek.map((c) => c.future)).toEqual([false, false, false, true, true, true, true]);
    expect(thisWeek[4]).toMatchObject({ date: "2024-06-14", count: 0, level: 0 }); // data for a future date is ignored
  });

  it("places counts on the right day and totals them", () => {
    const grid = buildActivityGrid(
      [
        { date: "2024-06-12", count: 3 },
        { date: "2024-06-10", count: 1 },
        { date: "2024-03-25", count: 2 }, // the very first cell
      ],
      WED
    );
    expect(grid.weeks[11]![2]).toMatchObject({ date: "2024-06-12", count: 3, level: 2 });
    expect(grid.weeks[11]![0]).toMatchObject({ date: "2024-06-10", count: 1, level: 1 });
    expect(grid.weeks[0]![0]).toMatchObject({ date: "2024-03-25", count: 2 });
    expect(grid.total).toBe(6);
    expect(grid.activeDays).toBe(3);
  });

  it("ignores activity older than the grid", () => {
    const grid = buildActivityGrid([{ date: "2024-03-24", count: 9 }], WED);
    expect(grid.total).toBe(0);
    expect(grid.activeDays).toBe(0);
  });

  it("works when today is a Monday (the current week has a single visible day) and a Sunday (a full week)", () => {
    const monday = buildActivityGrid([], "2024-06-10");
    expect(monday.weeks[11]!.map((c) => c.future)).toEqual([false, true, true, true, true, true, true]);

    const sunday = buildActivityGrid([], "2024-06-16");
    expect(sunday.weeks[11]!.every((c) => !c.future)).toBe(true);
  });

  it("is reachable with the number of days the server is asked for", () => {
    // On a Sunday the grid's first cell is the furthest back it ever gets.
    expect(activityDaysNeeded(12)).toBe(84);
    const sunday = "2024-06-16";
    const first = buildActivityGrid([], sunday, 12).weeks[0]![0]!.date;
    const daysBack = (Date.parse(`${sunday}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000;
    expect(daysBack + 1).toBeLessThanOrEqual(activityDaysNeeded(12));
  });
});

describe("activityLevel", () => {
  it("buckets counts from none to busiest", () => {
    expect([0, 1, 2, 3, 4, 6, 7, 40].map(activityLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
});
