"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { CheckCircle2, Dumbbell, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TranslatedMistake } from "@/lib/schemas";
import { useLocale } from "@/lib/i18n/locale-context";
import { useBatchContentTranslation } from "@/lib/i18n/use-content-translation";

const RESOLVE_THRESHOLD = 3;

export function MistakeList({
  userId,
  titleByTopicId,
}: {
  userId: Id<"users">;
  titleByTopicId: Record<string, string>;
}) {
  const { t } = useLocale();
  const mistakes = useQuery(api.mistakes.listOpenMistakes, { userId });
  const resolved = useQuery(api.mistakes.listResolvedMistakes, { userId, limit: 5 });
  const markResolved = useMutation(api.mistakes.markMistakeResolved);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Silently translates whichever mistakes are currently loaded whenever
  // their contentLocale doesn't match the learner's current locale — same
  // batched, per-row approach as the practice board (see
  // app/api/translate/mistake/route.ts).
  const translationCandidates = [...(mistakes ?? []), ...(resolved ?? [])].map((m) => ({
    id: m._id,
    contentLocale: m.contentLocale,
  }));
  const translatedById = useBatchContentTranslation<TranslatedMistake>(
    "/api/translate/mistake",
    "mistakeIds",
    translationCandidates
  );

  if (mistakes === undefined) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label={t.common.loading}>
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
      </div>
    );
  }

  async function handleResolve(mistakeId: Id<"mistakes">) {
    setResolvingId(mistakeId);
    try {
      await markResolved({ userId, mistakeId });
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {mistakes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{t.mistakes.none}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m) => (
            <Card key={m._id}>
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {titleByTopicId[m.topicId] ?? t.mistakes.unknownTopic}
                  </span>
                  <Badge variant={m.occurrences >= 3 ? "destructive" : "medium"}>
                    ×{m.occurrences} {m.occurrences >= 3 ? t.mistakes.conceptualGap : ""}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/90">{translatedById[m._id]?.description ?? m.description}</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {t.mistakes.firstSeen(new Date(m.firstDetectedAt).toLocaleDateString())} ·{" "}
                    {t.mistakes.lastSeen(new Date(m.lastDetectedAt).toLocaleDateString())}
                    {(m.consecutiveCleanAttempts ?? 0) > 0 && (
                      <> · {t.mistakes.cleanStreak(m.consecutiveCleanAttempts ?? 0, RESOLVE_THRESHOLD)}</>
                    )}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Drills the mistake's topic: exercise generation is fed the
                        learner's recurring mistakes, so this targets it directly. */}
                    <Button asChild size="sm">
                      <Link href={`/practice/${m.topicId}`}>
                        <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                        {t.mistakes.practiceThis}
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resolvingId === m._id}
                      onClick={() => handleResolve(m._id)}
                    >
                      {resolvingId === m._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        t.mistakes.markResolved
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {resolved !== undefined && resolved.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.mistakes.recentlyResolved}</h2>
          <div className="space-y-2">
            {resolved.map((m) => (
              <Card key={m._id} className="opacity-70">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-mastery-strong" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground/90">{translatedById[m._id]?.description ?? m.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleByTopicId[m.topicId] ?? t.mistakes.unknownTopic} ·{" "}
                      {t.mistakes.resolvedOn(new Date(m.resolvedAt ?? m.lastDetectedAt).toLocaleDateString())}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
