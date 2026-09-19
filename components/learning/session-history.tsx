"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/lib/i18n/locale-context";

export interface SessionRow {
  _id: string;
  topicId: string;
  /** null when the topic no longer exists. */
  topicTitle: string | null;
  startedAt: number;
  completedAt?: number;
  exercisesCompleted: number;
  exercisesPlanned: number;
}

/**
 * Recent practice sessions. Each shows its topic (the stored objective is the
 * same sentence every time, so it can't tell sessions apart), whether it was
 * finished, and - for a topic that still exists - links back to it.
 */
export function SessionHistory({ sessions }: { sessions: SessionRow[] }) {
  const { t } = useLocale();

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.progress.noSessions}</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const done = s.completedAt !== undefined;
        const title = s.topicTitle ?? t.mistakes.unknownTopic;
        // Older sessions could record more submissions than planned exercises.
        const completed = Math.min(s.exercisesCompleted, s.exercisesPlanned);
        return (
          <Card key={s._id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                {s.topicTitle ? (
                  <Link href={`/learn/${s.topicId}`} className="text-sm font-medium hover:text-accent">
                    {title}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{title}</p>
                )}
                <p className="text-xs text-muted-foreground">{new Date(s.startedAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge variant={done ? "strong" : "outline"}>
                  {done ? t.progress.sessionCompleted : t.progress.sessionInProgress}
                </Badge>
                <span className="font-mono-tabular text-xs text-muted-foreground">
                  {completed} / {s.exercisesPlanned}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
