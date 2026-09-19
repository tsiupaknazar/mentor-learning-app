"use client";

import { buildActivityGrid, type ActivityDay } from "@/lib/activity";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

const LEVEL_CLASS = {
  0: "bg-muted",
  1: "bg-accent/25",
  2: "bg-accent/45",
  3: "bg-accent/70",
  4: "bg-accent",
} as const;

/**
 * A GitHub-style calendar of how much the learner practised each day - a
 * picture of consistency that the bare streak number can't give. Each cell is
 * individually labelled ("2024-06-12: 3 answers") for screen readers, and a
 * text summary sits alongside since colour alone shouldn't carry the meaning.
 * `todayIso` comes from the server so the grid is the same on both sides of hydration.
 */
export function ActivityCalendar({
  days,
  todayIso,
  weeks = 12,
}: {
  days: ActivityDay[];
  todayIso: string;
  weeks?: number;
}) {
  const { t } = useLocale();
  const grid = buildActivityGrid(days, todayIso, weeks);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t.progress.activityTitle}</h2>
        <p className="font-mono-tabular text-xs text-muted-foreground">
          {t.progress.activitySummary(grid.total, grid.activeDays)}
        </p>
      </div>

      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex w-max gap-1" role="group" aria-label={t.progress.activityTitle}>
          {grid.weeks.map((week) => (
            <div key={week[0]!.date} className="flex flex-col gap-1">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  role="img"
                  aria-label={cell.future ? undefined : t.progress.activityCell(cell.date, cell.count)}
                  aria-hidden={cell.future || undefined}
                  title={cell.future ? undefined : t.progress.activityCell(cell.date, cell.count)}
                  className={cn("h-3 w-3 rounded-[3px]", cell.future ? "invisible" : LEVEL_CLASS[cell.level])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
        {t.progress.activityLess}
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className={cn("h-3 w-3 rounded-[3px]", LEVEL_CLASS[level])} />
        ))}
        {t.progress.activityMore}
      </div>
    </div>
  );
}
