"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useLocale } from "@/lib/i18n/locale-context";

/**
 * A spinner for AI calls that take several seconds: instead of one frozen
 * label, it walks through `messages` (advancing every `intervalMs`, holding
 * on the last) so the wait reads as progress, and adds a reassurance line if
 * it drags past `slowAfterMs`. `skeleton` adds placeholder blocks shaped
 * like the result about to appear (a feedback panel), which also keeps the
 * layout from jumping when it lands. Announced politely to screen readers.
 */
export function LoadingSteps({
  messages,
  intervalMs = 2500,
  slowAfterMs = 15000,
  skeleton = false,
}: {
  messages: string[];
  intervalMs?: number;
  slowAfterMs?: number;
  skeleton?: boolean;
}) {
  const { t } = useLocale();
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTicks((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const message = messages[Math.min(ticks, messages.length - 1)];
  const slow = ticks * intervalMs >= slowAfterMs;

  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
      <p className="font-mono text-sm text-muted-foreground">{message}</p>
      {slow && <p className="text-xs text-muted-foreground/80">{t.common.stillWorking}</p>}
      {skeleton && (
        <div className="mt-6 w-full max-w-xl space-y-3 rounded-lg border border-border bg-surface p-4" aria-hidden>
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      )}
    </div>
  );
}
