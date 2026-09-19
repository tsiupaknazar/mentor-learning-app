"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, Loader2, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";

type Category = "bug" | "idea" | "other";
type Status = "idle" | "submitting" | "sent" | "error";

/**
 * Always-visible feedback entry point (see product-memory: "minimal
 * always-visible feedback button with auto-captured route context").
 * Deliberately sends straight to email (see app/api/feedback/route.ts +
 * lib/email.ts) rather than writing to a Convex table — nothing to check,
 * it just lands in an inbox.
 */
export function FeedbackButton() {
  const { t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("idea");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const categories: { value: Category; label: string }[] = [
    { value: "bug", label: t.feedbackForm.categoryBug },
    { value: "idea", label: t.feedbackForm.categoryIdea },
    { value: "other", label: t.feedbackForm.categoryOther },
  ];

  function reset() {
    setMessage("");
    setCategory("idea");
    setStatus("idle");
  }

  async function handleSubmit() {
    if (!message.trim() || status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, category, route: pathname }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground shadow-lg transition-colors hover:border-accent/50 hover:bg-muted"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden />
        {t.feedbackForm.buttonLabel}
      </button>

      <DialogContent className="sm:max-w-md">
        {status === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
              <Check className="h-5 w-5 text-accent" aria-hidden />
            </div>
            <p className="text-sm font-medium">{t.feedbackForm.sentTitle}</p>
            <p className="text-sm text-muted-foreground">{t.feedbackForm.sentBody}</p>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t.feedbackForm.close}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.feedbackForm.dialogTitle}</DialogTitle>
              <DialogDescription>{t.feedbackForm.dialogDescription}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t.feedbackForm.categoryLabel}</p>
                <div className="flex gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs transition-colors",
                        category === c.value
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border bg-surface text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t.feedbackForm.messageLabel}</p>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.feedbackForm.messagePlaceholder}
                  rows={5}
                  maxLength={2000}
                />
              </div>

              {status === "error" && <p role="alert" className="text-sm text-destructive">{t.feedbackForm.errorBody}</p>}

              <Button onClick={handleSubmit} disabled={!message.trim() || status === "submitting"} className="w-full">
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t.feedbackForm.submitting}
                  </>
                ) : (
                  t.feedbackForm.submit
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
