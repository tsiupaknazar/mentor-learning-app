import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMastery } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { nextActionTarget, type NextActionKind } from "@/lib/next-action";
import { PathCompleteCard } from "@/components/learning/path-complete-card";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");
  const summary = await convexQuery(api.dashboard.getDashboardSummary, { userId: user._id });
  const mistakes = await convexQuery(api.mistakes.listOpenMistakes, { userId: user._id });

  if (!summary) return null;

  const nextActionKind = summary.nextAction?.kind as "review" | "continue" | "start" | undefined;
  const actionCopy = nextActionKind ? t.dashboard.nextActionCopy[nextActionKind] : null;
  const { href: actionHref, isReview } = summary.nextAction
    ? nextActionTarget(summary.nextAction.kind as NextActionKind, summary.nextAction.topicId)
    : { href: "/learn", isReview: false };

  const stats: { label: string; hint: string; value: string }[] = [
    { label: t.dashboard.overallMastery, hint: t.dashboard.statHints.overallMastery, value: formatMastery(summary.overallMastery) },
    {
      label: t.dashboard.topicsMastered,
      hint: t.dashboard.statHints.topicsMastered,
      value: `${summary.topicsMastered}/${summary.topicsCount}`,
    },
    { label: t.dashboard.streak, hint: t.dashboard.statHints.streak, value: `${summary.user.currentStreak}d` },
    { label: t.dashboard.xp, hint: t.dashboard.statHints.xp, value: String(summary.user.totalXp) },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {t.dashboard.welcomeBack}, {summary.user.displayName}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            {summary.activePathTitle ?? t.dashboard.defaultPathTitle}
          </h1>
        </div>
        {summary.activePathTitle && (
          <Link
            href="/learn/new"
            className="shrink-0 pt-1 text-xs text-accent underline underline-offset-4"
          >
            {t.learn.startNewTopic}
          </Link>
        )}
      </div>

      {/* Primary next action — the one hero moment on this page. Everything
          else recedes; this is the only element with the hard offset
          shadow and the only place the pending-gold rule appears as a
          structural mark rather than decoration. */}
      {summary.nextAction ? (
        <div className="relative border border-border bg-card shadow-stack">
          <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />
          <div className="flex flex-col gap-5 p-7 pl-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-accent">{actionCopy}</p>
              <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                {summary.nextAction.topicTitle}
              </h2>
              {summary.nextAction.mastery > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.dashboard.masterySoFar(formatMastery(summary.nextAction.mastery))}
                </p>
              )}
              {isReview && summary.reviewsDue > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">{t.dashboard.moreReviewsDue(summary.reviewsDue - 1)}</p>
              )}
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href={actionHref}>
                {isReview ? t.dashboard.reviewButton : t.dashboard.continueButton}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      ) : summary.pathComplete ? (
        <PathCompleteCard />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t.dashboard.noActivePath}{" "}
            <Link href="/learn/new" className="text-accent underline underline-offset-4">
              {t.dashboard.chooseTopic}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stat strip — deliberately not four identical cards. A single
          quiet row, mono-tabular numbers, hairline dividers. Nothing here
          should compete with the hero panel above. */}
      <div className="flex flex-wrap divide-x divide-border border-y border-border">
        {stats.map((s) => (
          <div key={s.label} className="flex-1 px-5 py-4 first:pl-0">
            <p className="font-mono-tabular text-2xl font-semibold">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-muted-foreground/80">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Recent mistakes preview — styled as a marked-up list, not more
          cards. The redline rule only appears here because this genuinely
          is a critique/review surface. */}
      {mistakes.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">{t.dashboard.needsReview}</h2>
            <Link href="/mistakes" className="text-xs text-accent underline underline-offset-4">
              {t.dashboard.viewAll}
            </Link>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {mistakes.slice(0, 3).map((m: { _id: string; topicId: string; description: string; occurrences: number }) => (
              <div key={m._id} className="flex items-center justify-between gap-4 border-l-2 border-redline py-3 pl-4">
                <p className="text-sm">{m.description}</p>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={m.occurrences >= 3 ? "destructive" : "medium"} className="font-mono-tabular">
                    ×{m.occurrences}
                  </Badge>
                  <Link
                    href={`/practice/${m.topicId}`}
                    className="text-xs text-accent underline underline-offset-4"
                  >
                    {t.mistakes.practiceThis}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
