"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * Shown in place of SessionRunner when a learner navigates straight to a
 * locked topic's URL (bypassing the disabled card in LearnPathView). Same
 * lock — see convex/lib/topicLocking.ts — just reached a different way.
 */
export function LockedTopicNotice({ topicTitle }: { topicTitle: string }) {
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
          <Button asChild variant="outline">
            <Link href="/learn">{t.learn.backToPath}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
