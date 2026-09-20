"use client";

import { useState } from "react";
import { AlertCircle, Award, BookOpen, CheckCircle2, Loader2, MinusCircle, TrendingUp } from "lucide-react";

import type { Evaluation, MentorFollowUpReaction } from "@/lib/schemas";
import type { Id } from "@/convex/_generated/dataModel";
import type { AttemptReward } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";

const RESULT_ICON = {
  correct: { icon: CheckCircle2, className: "text-mastery-strong" },
  partially_correct: { icon: MinusCircle, className: "text-mastery-medium" },
  incorrect: { icon: AlertCircle, className: "text-mastery-weak" },
} as const;

const SCORE_KEYS: Array<keyof Evaluation["scores"]> = [
  "correctness",
  "logic",
  "codeQuality",
  "bestPractices",
  "edgeCaseHandling",
];

export function FeedbackPanel({
  evaluation,
  exerciseId,
  onRevisitLesson,
}: {
  evaluation: Evaluation;
  /** Needed to answer `mentorFollowUp` — omit to render the question as read-only (no reply box). */
  exerciseId?: Id<"exercises">;
  /** Offered when the review traced the mistake to a lesson section; omit if there's no lesson to go back to. */
  onRevisitLesson?: (heading: string) => void;
}) {
  const { t } = useLocale();
  const meta = RESULT_ICON[evaluation.result];
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className={cn("h-4 w-4", meta.className)} aria-hidden />
        <span className={cn("font-mono text-xs font-semibold uppercase tracking-wide", meta.className)}>
          {t.feedback.resultLabels[evaluation.result]}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <FeedbackRow label={t.feedback.whatYouDid} text={evaluation.whatYouDid} />
        {evaluation.problem && <FeedbackRow label={t.feedback.problem} text={evaluation.problem} tone="weak" />}
        {evaluation.whyItMatters && <FeedbackRow label={t.feedback.whyItMatters} text={evaluation.whyItMatters} />}
        {evaluation.hint && <FeedbackRow label={t.feedback.hint} text={evaluation.hint} tone="medium" />}
        <FeedbackRow label={t.feedback.nextStep} text={evaluation.nextStep} />

        {evaluation.detectedMisconception && (
          <div className="rounded-md border border-mastery-weak/30 bg-mastery-weak/6 p-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-mastery-weak">
              {t.feedback.conceptualGapDetected}
            </p>
            <p className="mt-1 text-sm text-foreground/90">{evaluation.detectedMisconception}</p>
          </div>
        )}

        {evaluation.relatedLessonSection && onRevisitLesson && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRevisitLesson(evaluation.relatedLessonSection!)}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            {t.feedback.revisitLesson(evaluation.relatedLessonSection)}
          </Button>
        )}

        {evaluation.mentorFollowUp && (
          <MentorFollowUp question={evaluation.mentorFollowUp} exerciseId={exerciseId} />
        )}

        <div className="border-t border-border pt-4">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t.feedback.scoreBreakdown}
          </p>
          <div className="space-y-2">
            {SCORE_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{t.feedback.scoreLabels[key]}</span>
                <Progress value={evaluation.scores[key]} className="h-1.5 flex-1" />
                <span className="w-9 shrink-0 text-right font-mono-tabular text-xs text-muted-foreground">
                  {evaluation.scores[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * `mentorFollowUp` is generated as a direct question aimed at the learner
 * (see buildEvaluationPrompt) — showing it as inert text with no way to
 * reply made the mentor look like it was asking rhetorically. This makes
 * it a real, bounded one-turn exchange: reply once, get a short reaction.
 * Ungraded — doesn't touch scores/mastery, see /api/mentor-followup.
 */
function MentorFollowUp({ question, exerciseId }: { question: string; exerciseId?: Id<"exercises"> }) {
  const { t } = useLocale();
  const [reply, setReply] = useState("");
  const [submittedReply, setSubmittedReply] = useState<string | null>(null);
  const [reaction, setReaction] = useState<MentorFollowUpReaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond() {
    if (!reply.trim() || !exerciseId) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{ reaction: MentorFollowUpReaction }>("/api/mentor-followup", {
        exerciseId,
        followUpQuestion: question,
        learnerResponse: reply,
      });
      setSubmittedReply(reply);
      setReaction(data.reaction);
    } catch (e) {
      setError(apiErrorMessage(e, t, t.feedback.couldNotGetReaction));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-accent/30 bg-accent/5 p-3">
      <p className="font-mono text-[11px] uppercase tracking-wide text-accent">{t.feedback.mentorFollowUp}</p>
      <p className="text-sm text-foreground/90">{question}</p>

      {exerciseId && !submittedReply && (
        <div className="space-y-2 pt-1">
          <Textarea
            placeholder={t.feedback.followUpPlaceholder}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            className="bg-background text-sm"
          />
          <Button size="sm" onClick={handleRespond} disabled={submitting || !reply.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t.feedback.responding}
              </>
            ) : (
              t.feedback.respondButton
            )}
          </Button>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {submittedReply && (
        <div className="space-y-2 border-t border-accent/20 pt-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {t.feedback.yourReply}
            </p>
            <p className="text-sm text-foreground/90">{submittedReply}</p>
          </div>
          {reaction && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-accent">{t.feedback.mentorReaction}</p>
              <p className="text-sm text-foreground/90">{reaction.reaction}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackRow({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone?: "weak" | "medium";
}) {
  return (
    <div>
      <p
        className={cn(
          "font-mono text-[11px] uppercase tracking-wide",
          tone === "weak" ? "text-mastery-weak" : tone === "medium" ? "text-mastery-medium" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

/**
 * Shown under the feedback so progress is visible the moment it's earned:
 * XP, the topic's mastery movement, and any badge just unlocked. XP and
 * mastery are computed deterministically server-side (convex/attempts.ts) -
 * this only displays them. Renders nothing when the attempt earned no XP,
 * moved no mastery and unlocked nothing (e.g. a wrong answer on a mastered topic).
 */
export function RewardStrip({ reward }: { reward: AttemptReward }) {
  const { t } = useLocale();
  const before = Math.round(reward.masteryBefore);
  const after = Math.round(reward.masteryAfter);
  const badges = reward.newAchievements
    .map((key) => ({ key, meta: t.achievements.catalog[key as keyof typeof t.achievements.catalog] }))
    .filter((b) => b.meta);

  if (reward.xpAwarded <= 0 && before === after && badges.length === 0) return null;

  return (
    <div role="status" className="space-y-2 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {reward.xpAwarded > 0 && (
          <span className="font-mono-tabular font-semibold text-accent">{t.feedback.rewardXp(reward.xpAwarded)}</span>
        )}
        {before !== after && (
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs",
              after > before ? "text-mastery-strong" : "text-mastery-weak"
            )}
          >
            <TrendingUp className={cn("h-3.5 w-3.5", after < before && "-scale-y-100")} aria-hidden />
            {t.feedback.rewardMastery(before, after)}
          </span>
        )}
      </div>
      {badges.map(({ key, meta }) => (
        <div key={key} className="flex items-start gap-2.5 rounded-md border border-accent/30 bg-accent/5 p-2.5">
          <Award className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-accent">{t.feedback.rewardAchievement}</p>
            <p className="text-sm font-semibold">{meta!.title}</p>
            <p className="text-xs text-muted-foreground">{meta!.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultBadge({ result }: { result: Evaluation["result"] }) {
  const { t } = useLocale();
  const variant = result === "correct" ? "strong" : result === "partially_correct" ? "medium" : "weak";
  return <Badge variant={variant}>{t.feedback.resultLabels[result]}</Badge>;
}
