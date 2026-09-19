"use client";

import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";

/** Interview mode isn't built yet; this is what anyone who reaches /interview sees. */
export function InterviewPlaceholder() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <MessagesSquare className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">{t.interview.title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t.interview.body1}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/dashboard">{t.session.backToDashboard}</Link>
      </Button>
    </div>
  );
}
