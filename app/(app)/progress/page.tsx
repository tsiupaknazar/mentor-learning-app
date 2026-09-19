import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Award } from "lucide-react";
import { formatMastery } from "@/lib/utils";
import { ActivityCalendar } from "@/components/learning/activity-calendar";
import { SessionHistory, type SessionRow } from "@/components/learning/session-history";
import { activityDaysNeeded } from "@/lib/activity";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ProgressPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");
  const [summary, sessions, achievements, activity] = await Promise.all([
    convexQuery(api.dashboard.getDashboardSummary, { userId: user._id }),
    convexQuery(api.sessions.listRecentSessions, { userId: user._id, limit: 15 }),
    convexQuery(api.achievements.listAchievements, { userId: user._id }),
    convexQuery(api.attempts.activityByDay, { userId: user._id, days: activityDaysNeeded(12) }),
  ]);
  const todayIso = new Date().toISOString().slice(0, 10);

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t.progress.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t.progress.title(summary.user.displayName)}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat label={t.progress.overallMastery} value={formatMastery(summary.overallMastery)} />
        <MiniStat label={t.progress.currentStreak} value={`${summary.user.currentStreak}d`} />
        <MiniStat label={t.progress.longestStreak} value={`${summary.user.longestStreak}d`} />
        <MiniStat label={t.progress.totalXp} value={String(summary.user.totalXp)} />
      </div>

      <ActivityCalendar days={activity} todayIso={todayIso} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.achievements.sectionTitle}</h2>
        {achievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.achievements.none}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a: { _id: string; key: string; earnedAt: number }) => {
              const meta =
                t.achievements.catalog[a.key as keyof typeof t.achievements.catalog] ??
                undefined;
              if (!meta) return null;
              return (
                <Card key={a._id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <Award className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{meta.title}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.achievements.earnedOn(new Date(a.earnedAt).toLocaleDateString())}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.progress.recentSessions}</h2>
        <SessionHistory sessions={sessions as SessionRow[]} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono-tabular text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
