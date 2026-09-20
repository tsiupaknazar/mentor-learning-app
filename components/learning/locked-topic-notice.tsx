"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * Shown in place of a Learn or Practice session when a learner reaches a topic
 * that's still ahead of them in their path - by the URL, or from an old link.
 * It says what to finish first and links straight to it, so the block reads as
 * a direction rather than a wall. The rules live in convex/lib/curriculum.ts.
 */
export function LockedTopicNotice({
  topicTitle,
  blockedBy = [],
  backHref = "/learn",
  backLabel,
  note,
}: {
  topicTitle: string;
  /** The topics to finish first (the closest unfinished one, or the unmet prerequisites). */
  blockedBy?: { _id: string; title: string }[];
  backHref?: string;
  backLabel?: string;
  /** Extra context, e.g. why Practice is closed for this topic. */
  note?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">{t.learn.lockedNoticeTitle}</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {topicTitle} — {t.learn.lockedNoticeBody}
          </p>
          {note && <p className="max-w-sm text-xs text-muted-foreground">{note}</p>}
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {blockedBy
              .filter((b) => b.title)
              .map((b) => (
                <Button key={b._id} asChild>
                  <Link href={`/learn/${b._id}`}>{t.learn.lockedNoticeGoTo(b.title)}</Link>
                </Button>
              ))}
            <Button asChild variant="outline">
              <Link href={backHref}>{backLabel ?? t.learn.backToPath}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
