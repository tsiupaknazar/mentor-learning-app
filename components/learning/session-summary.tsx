"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RewardStrip, ResultBadge } from "@/components/learning/feedback-panel";
import { useLocale } from "@/lib/i18n/locale-context";
import { roundTotals, type RoundLog } from "@/lib/round-log";

/**
 * The end-of-round screen: how it went (correct count, XP, mastery movement,
 * badges), each answer's verdict, and any misconceptions worth a second look -
 * instead of a bare "5 exercises reviewed".
 */
export function SessionSummary({
  log,
  topicTitle,
  exerciseCount,
  backHref,
  backLabel,
  onAnotherRound,
  notYetDone = false,
}: {
  log: RoundLog;
  topicTitle: string;
  exerciseCount: number;
  backHref: string;
  backLabel: string;
  onAnotherRound: () => void;
  /** A Learn session that didn't get enough right to count as having learned the topic. */
  notYetDone?: boolean;
}) {
  const { t } = useLocale();
  const { correct, total, xp } = roundTotals(log);

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-2 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-accent" aria-hidden />
        <h2 className="text-xl font-semibold">{t.session.sessionComplete}</h2>
        <p className="text-sm text-muted-foreground">{t.session.exercisesReviewed(exerciseCount, topicTitle)}</p>
        {total > 0 && (
          <p className="font-mono-tabular text-2xl font-semibold">{t.session.summaryCorrect(correct, total)}</p>
        )}
      </div>

      {notYetDone && (
        <p role="status" className="rounded-lg border border-border bg-surface p-4 text-sm text-foreground/90">
          {t.session.summaryNotYet}
        </p>
      )}

      {total > 0 && (
        <RewardStrip
          reward={{
            xpAwarded: xp,
            masteryBefore: log.masteryStart ?? 0,
            masteryAfter: log.masteryNow ?? 0,
            newAchievements: log.achievements,
          }}
        />
      )}

      {total > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t.session.summaryAnswers}
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {log.entries.map((entry) => (
              <li key={entry.exerciseId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm">{entry.title}</span>
                <ResultBadge result={entry.result} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {log.misconceptions.length > 0 && (
        <div className="rounded-lg border border-mastery-weak/30 bg-mastery-weak/6 p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wide text-mastery-weak">{t.session.summaryReview}</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground/90">
            {log.misconceptions.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Link href="/mistakes" className="mt-3 inline-block text-xs text-accent underline underline-offset-4">
            {t.session.summaryViewMistakes}
          </Link>
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onAnotherRound}>
          {t.session.anotherRound}
        </Button>
        <Button asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
