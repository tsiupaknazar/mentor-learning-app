"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import type { TranslatedLearningPath } from "@/lib/schemas";
import type { Locale } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMastery, masteryBand } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";
import { useContentTranslation } from "@/lib/i18n/use-content-translation";

export type LearnTopicRow = {
  _id: string;
  externalId: string;
  title: string;
  summary: string;
  parentTopicId?: string;
  orderIndex: number;
  prerequisiteExternalIds: string[];
  // Computed server-side (convex/learningPaths.ts getActiveLearningPath,
  // see convex/lib/topicLocking.ts) — true until every prerequisite topic
  // is mastered.
  locked: boolean;
  progress: {
    mastery: { overall: number };
    status: "not_started" | "in_progress" | "needs_review" | "mastered";
    attemptsCount: number;
  } | null;
};

export function LearnPathView({
  learningPathId,
  contentLocale,
  path,
  topics,
}: {
  learningPathId: string;
  contentLocale: Locale | undefined;
  path: { title: string; rationale: string };
  topics: LearnTopicRow[];
}) {
  const { t } = useLocale();
  const translated = useContentTranslation<TranslatedLearningPath>(
    "/api/translate/learning-path",
    "learningPathId",
    learningPathId,
    contentLocale
  );

  const translatedByExternalId = new Map((translated?.topics ?? []).map((tp) => [tp.externalId, tp]));
  const title = translated?.title ?? path.title;
  const rationale = translated?.rationale ?? path.rationale;

  // Display title per topic (translated when available) keyed by
  // externalId, so a locked topic's "Requires: ..." list can name its
  // prerequisites in the learner's own language rather than raw ids.
  const displayTitleByExternalId = new Map(
    topics.map((tp) => [tp.externalId, translatedByExternalId.get(tp.externalId)?.title ?? tp.title])
  );

  const roots = topics.filter((tp) => !tp.parentTopicId).sort((a, b) => a.orderIndex - b.orderIndex);
  const childrenOf = (id: string) =>
    topics.filter((tp) => tp.parentTopicId === id).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {t.learn.eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{rationale}</p>
        </div>
        <Link href="/learn/new" className="shrink-0 text-xs text-accent underline underline-offset-4">
          {t.learn.startNewTopic}
        </Link>
      </div>

      <div className="space-y-3">
        {roots.map((topic) => (
          <TopicNode
            key={topic._id}
            topic={topic}
            childTopics={childrenOf(topic._id)}
            depth={0}
            notStartedLabel={t.learn.notStarted}
            lockedLabel={t.learn.locked}
            lockedRequires={t.learn.lockedRequires}
            translatedByExternalId={translatedByExternalId}
            displayTitleByExternalId={displayTitleByExternalId}
          />
        ))}
      </div>
    </div>
  );
}

function TopicNode({
  topic,
  childTopics,
  depth,
  notStartedLabel,
  lockedLabel,
  lockedRequires,
  translatedByExternalId,
  displayTitleByExternalId,
}: {
  topic: LearnTopicRow;
  childTopics: LearnTopicRow[];
  depth: number;
  notStartedLabel: string;
  lockedLabel: string;
  lockedRequires: (titles: string) => string;
  translatedByExternalId: Map<string, { title: string; summary: string }>;
  displayTitleByExternalId: Map<string, string>;
}) {
  const mastery = topic.progress?.mastery.overall ?? 0;
  const band = masteryBand(mastery);
  const status = topic.progress?.status ?? "not_started";
  const tr = translatedByExternalId.get(topic.externalId);
  const title = tr?.title ?? topic.title;
  const summary = tr?.summary ?? topic.summary;

  const requiresText = topic.locked
    ? lockedRequires(
        topic.prerequisiteExternalIds.map((id) => displayTitleByExternalId.get(id) ?? id).join(", ")
      )
    : null;

  const cardBody = (
    <Card className={cn("transition-colors", topic.locked ? "opacity-60" : "hover:border-accent/50")}>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {topic.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            {title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{topic.locked ? requiresText : summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {topic.locked ? (
            <Badge variant="outline">{lockedLabel}</Badge>
          ) : status === "not_started" ? (
            <Badge variant="outline">{notStartedLabel}</Badge>
          ) : (
            <Badge variant={band}>{formatMastery(mastery)}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div style={{ marginLeft: depth * 20 }}>
      {topic.locked ? (
        <div aria-disabled="true">{cardBody}</div>
      ) : (
        <Link href={`/learn/${topic._id}`}>{cardBody}</Link>
      )}
      {childTopics.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border pl-3">
          {childTopics.map((c) => (
            <TopicNode
              key={c._id}
              topic={c}
              childTopics={[]}
              depth={0}
              notStartedLabel={notStartedLabel}
              lockedLabel={lockedLabel}
              lockedRequires={lockedRequires}
              translatedByExternalId={translatedByExternalId}
              displayTitleByExternalId={displayTitleByExternalId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
