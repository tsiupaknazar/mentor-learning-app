"use client";

import Link from "next/link";
import { Dumbbell, Lock } from "lucide-react";

import type { TranslatedLearningPath } from "@/lib/schemas";
import type { Locale } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMastery, masteryBand } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";
import { useContentTranslation } from "@/lib/i18n/use-content-translation";
import { orderTopicsForLearning } from "@/convex/lib/topicOrder";
import { weakestAxis } from "@/lib/weakest-axis";

const AXIS_KEYS = ["knowledge", "application", "debugging", "explanation", "retention"] as const;

export interface KnowledgeTopic {
  _id: string;
  externalId: string;
  title: string;
  parentTopicId?: string;
  orderIndex: number;
  locked: boolean;
  adHoc?: boolean;
  progress: {
    mastery: Record<string, number>;
    status: string;
    attemptsCount: number;
    nextReviewDue?: number;
  } | null;
}

const BAND_TEXT = {
  strong: "text-mastery-strong",
  medium: "text-mastery-medium",
  weak: "text-mastery-weak",
} as const;

/**
 * Per-topic skill breakdown, laid out like the learning path itself: in path
 * order, sub-topics indented under their parent. Beyond the bars it says what
 * to do about them - a review that's due, locked topics still gated, and for
 * a topic with a genuinely weak skill, a way straight into practising it.
 * `nowMs` comes from the server so "due" is decided once, not per render.
 */
export function KnowledgeMapView({
  learningPathId,
  contentLocale,
  pathTitle,
  topics,
  nowMs,
}: {
  learningPathId: string;
  contentLocale: Locale | undefined;
  pathTitle: string;
  topics: KnowledgeTopic[];
  nowMs: number;
}) {
  const { t } = useLocale();
  const translated = useContentTranslation<TranslatedLearningPath>(
    "/api/translate/learning-path",
    "learningPathId",
    learningPathId,
    contentLocale
  );
  const translatedTitle = new Map((translated?.topics ?? []).map((tp) => [tp.externalId, tp.title]));

  // Free-form practice topics aren't steps of the path.
  const pathTopics = topics.filter((tp) => !tp.adHoc);
  const ordered = orderTopicsForLearning(pathTopics);
  const byId = new Map(pathTopics.map((tp) => [tp._id, tp]));
  const depthOf = (topic: KnowledgeTopic): number => {
    let depth = 0;
    let parent = topic.parentTopicId ? byId.get(topic.parentTopicId) : undefined;
    while (parent && depth < 5) {
      depth += 1;
      parent = parent.parentTopicId ? byId.get(parent.parentTopicId) : undefined;
    }
    return depth;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t.knowledgeMap.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{translated?.title ?? pathTitle}</h1>
      </div>

      <div className="space-y-3">
        {ordered.map((tp) => {
          const mastery = tp.progress?.mastery;
          const overall = mastery?.overall ?? 0;
          const band = masteryBand(overall);
          const title = translatedTitle.get(tp.externalId) ?? tp.title;
          const due =
            !!tp.progress &&
            tp.progress.status !== "mastered" &&
            tp.progress.nextReviewDue !== undefined &&
            tp.progress.nextReviewDue <= nowMs;
          const weakest = mastery && tp.progress ? weakestAxis(mastery, tp.progress.attemptsCount) : null;

          return (
            <div key={tp._id} style={{ marginLeft: depthOf(tp) * 16 }}>
              <Card className={tp.locked ? "opacity-60" : undefined}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {tp.locked ? (
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          {title}
                        </span>
                      ) : (
                        <Link href={`/learn/${tp._id}`} className="truncate text-sm font-medium hover:text-accent">
                          {title}
                        </Link>
                      )}
                      {tp.locked && <Badge variant="outline">{t.learn.locked}</Badge>}
                      {due && <Badge variant="medium">{t.knowledgeMap.reviewDue}</Badge>}
                    </div>
                    <span className={`font-mono text-sm ${BAND_TEXT[band]}`}>{formatMastery(overall)}</span>
                  </div>

                  {mastery ? (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {AXIS_KEYS.map((key) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="w-20 shrink-0 text-xs text-muted-foreground">{t.knowledgeMap.axes[key]}</span>
                            <Progress
                              value={mastery[key]}
                              className="h-1 flex-1"
                              aria-label={`${t.knowledgeMap.axes[key]} ${Math.round(mastery[key] ?? 0)}%`}
                            />
                          </div>
                        ))}
                      </div>
                      {weakest && !tp.locked && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                          <p className="text-xs text-mastery-weak">
                            {t.knowledgeMap.weakestAxis(t.knowledgeMap.axes[weakest.axis], weakest.value)}
                          </p>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/practice/${tp._id}`}>
                              <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                              {t.mistakes.practiceThis}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.knowledgeMap.notAttempted}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
