"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import type { Review } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";

const SEVERITY_ORDER = { blocking: 0, suggestion: 1, nit: 2 } as const;
const SEVERITY_VARIANT = {
  blocking: "destructive" as const,
  suggestion: "medium" as const,
  nit: "outline" as const,
};

/** PR-review-style verdict + severity-tagged comments (spec section 14: "AI performs a code review"). */
export function ReviewPanel({ review }: { review: Review }) {
  const { t } = useLocale();
  const approved = review.verdict === "approved";
  const sortedComments = [...review.comments].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-4 py-3",
          approved ? "text-mastery-strong" : "text-mastery-weak"
        )}
      >
        {approved ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        ) : (
          <XCircle className="h-4 w-4" aria-hidden />
        )}
        <span className="font-mono text-xs font-semibold uppercase tracking-wide">
          {approved ? t.reviewPanel.approved : t.reviewPanel.changesRequested}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-sm leading-relaxed text-foreground/90">{review.summary}</p>

        {sortedComments.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            {sortedComments.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-border p-3">
                <Badge variant={SEVERITY_VARIANT[c.severity]} className="mt-0.5 shrink-0">
                  {t.reviewPanel.severity[c.severity]}
                </Badge>
                <p className="text-sm text-foreground/90">{c.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
