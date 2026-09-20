"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import type { TranslatedLearningPath } from "@/lib/schemas";
import type { Locale } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  // Computed server-side (convex/learningPaths.ts getActiveLearningPath, see
  // convex/lib/curriculum.ts) — true while an earlier topic in the path (strict
  // order, beginners) or a prerequisite the AI named hasn't been passed yet.
  locked: boolean;
  // Why it's locked, and which topics to finish first (topic _ids) - see
  // convex/lib/curriculum.ts. Absent on rows from older callers, which fall back
  // to naming the AI's prerequisites.
  block?: "prerequisites" | "order" | null;
  blockedBy?: string[];
  /** Mastered, or a Learn session finished on it. */
  passed?: boolean;
  /** A free-form practice topic: not a step of the path, so it isn't shown here. */
  adHoc?: boolean;
  progress: {
    mastery: { overall: number };
    status: "not_started" | "in_progress" | "needs_review" | "mastered";
    attemptsCount: number;
  } | null;
};

/** Everything a node needs from the whole tree, so it can recurse without a growing prop list. */
interface TreeContext {
  /** Resolves a topic's direct children, so the tree renders to any depth (paths go 3 levels deep). */
  childrenOf: (id: string) => LearnTopicRow[];
  translatedByExternalId: Map<string, { title: string; summary: string }>;
  /** Display title (translated when available) by externalId, for naming prerequisites. */
  displayTitleByExternalId: Map<string, string>;
  rowByExternalId: Map<string, LearnTopicRow>;
  rowById: Map<string, LearnTopicRow>;
  /** The topic the dashboard would suggest next, if any. */
  nextTopicId: string | null;
}

export function LearnPathView({
  learningPathId,
  contentLocale,
  path,
  topics: allTopics,
  nextTopicId = null,
  strictOrder = false,
}: {
  learningPathId: string;
  contentLocale: Locale | undefined;
  path: { title: string; rationale: string };
  topics: LearnTopicRow[];
  nextTopicId?: string | null;
  /** The learner follows the path strictly in order (beginners). */
  strictOrder?: boolean;
}) {
  const { t } = useLocale();
  // Free-form practice topics aren't steps of the path.
  const topics = allTopics.filter((tp) => !tp.adHoc);
  const translated = useContentTranslation<TranslatedLearningPath>(
    "/api/translate/learning-path",
    "learningPathId",
    learningPathId,
    contentLocale
  );

  const translatedByExternalId = new Map((translated?.topics ?? []).map((tp) => [tp.externalId, tp]));
  const title = translated?.title ?? path.title;
  const rationale = translated?.rationale ?? path.rationale;

  const roots = topics.filter((tp) => !tp.parentTopicId).sort((a, b) => a.orderIndex - b.orderIndex);
  const childrenOf = (id: string) =>
    topics.filter((tp) => tp.parentTopicId === id).sort((a, b) => a.orderIndex - b.orderIndex);

  const ctx: TreeContext = {
    childrenOf,
    translatedByExternalId,
    displayTitleByExternalId: new Map(
      topics.map((tp) => [tp.externalId, translatedByExternalId.get(tp.externalId)?.title ?? tp.title])
    ),
    rowByExternalId: new Map(topics.map((tp) => [tp.externalId, tp])),
    rowById: new Map(topics.map((tp) => [tp._id, tp])),
    nextTopicId,
  };

  // "Completed" = passed (mastered, or a Learn session finished); rows from
  // callers that don't say fall back to mastered.
  const completedCount = topics.filter((tp) => tp.passed ?? tp.progress?.status === "mastered").length;

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

      {topics.length > 0 && (
        <div className="space-y-1.5">
          <Progress
            value={(completedCount / topics.length) * 100}
            className="h-1.5"
            aria-label={t.learn.topicsCompleted(completedCount, topics.length)}
          />
          <p className="font-mono-tabular text-xs text-muted-foreground">
            {t.learn.topicsCompleted(completedCount, topics.length)}
          </p>
          {strictOrder && <p className="pt-1 text-xs text-muted-foreground">{t.learn.strictOrderNote}</p>}
        </div>
      )}

      <div className="space-y-3">
        {roots.map((topic) => (
          <TopicNode key={topic._id} topic={topic} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function TopicNode({ topic, ctx }: { topic: LearnTopicRow; ctx: TreeContext }) {
  const { t } = useLocale();
  const mastery = topic.progress?.mastery.overall ?? 0;
  const band = masteryBand(mastery);
  const status = topic.progress?.status ?? "not_started";
  const tr = ctx.translatedByExternalId.get(topic.externalId);
  const title = tr?.title ?? topic.title;
  const summary = tr?.summary ?? topic.summary;
  const isNext = !topic.locked && topic._id === ctx.nextTopicId;
  const childTopics = ctx.childrenOf(topic._id);

  // A locked topic names what unlocks it - and links to each prerequisite that
  // can itself be started, so the way forward is one click, not a hunt.
  const blockers = !topic.locked
    ? []
    : topic.blockedBy
      ? topic.blockedBy.flatMap((id) => {
          const row = ctx.rowById.get(id);
          return row ? [{ id, title: ctx.displayTitleByExternalId.get(row.externalId) ?? row.title, row }] : [];
        })
      : topic.prerequisiteExternalIds.map((id) => ({
          id,
          title: ctx.displayTitleByExternalId.get(id) ?? id,
          row: ctx.rowByExternalId.get(id),
        }));
  const blockLabel = topic.block === "order" ? t.learn.finishFirstLabel : t.learn.lockedRequiresLabel;

  const cardBody = (
    <Card
      className={cn(
        "transition-colors",
        topic.locked ? "opacity-60" : "hover:border-accent/50",
        isNext && "border-accent/60"
      )}
    >
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {topic.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            {title}
          </p>
          {!topic.locked && <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isNext && <Badge variant="default">{t.learn.upNext}</Badge>}
          {topic.locked ? (
            <Badge variant="outline">{t.learn.locked}</Badge>
          ) : status === "not_started" ? (
            <Badge variant="outline">{t.learn.notStarted}</Badge>
          ) : (
            <Badge variant={band}>{formatMastery(mastery)}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      {topic.locked ? (
        <div aria-disabled="true">
          {cardBody}
          <p className="mt-1 pl-4 text-xs text-muted-foreground">
            {blockLabel}{" "}
            {blockers.map((pre, i) => (
              <span key={pre.id}>
                {i > 0 && ", "}
                {pre.row && !pre.row.locked ? (
                  <Link href={`/learn/${pre.row._id}`} className="text-accent underline underline-offset-4">
                    {pre.title}
                  </Link>
                ) : (
                  pre.title
                )}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <Link href={`/learn/${topic._id}`}>{cardBody}</Link>
      )}
      {childTopics.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border pl-3">
          {childTopics.map((c) => (
            <TopicNode key={c._id} topic={c} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}
