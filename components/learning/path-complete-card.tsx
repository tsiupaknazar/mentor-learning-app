"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/lib/i18n/locale-context";

/** Shown on the dashboard when every topic of the path is done - there is no "next step", so say so and point onward. */
export function PathCompleteCard() {
  const { t } = useLocale();
  return (
    <Card className="border-accent/40">
      <CardContent className="flex flex-col gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 className="font-serif text-xl font-bold tracking-tight">{t.dashboard.pathCompleteTitle}</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t.dashboard.pathCompleteBody}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild>
            <Link href="/learn/new">{t.learn.startNewTopic}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/practice">{t.sidebar.practice}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
