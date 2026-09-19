"use client";

import { useState } from "react";

import type { DiagnosticSet } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceList } from "@/components/learning/choice-list";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

/** Stored as an answer when the learner explicitly picks "I don't know". */
export const NOT_SURE = "__not_sure__";

function resolveAnswer(raw: string | undefined): string {
  if (!raw || !raw.trim()) return "(no answer given)";
  // An explicit "don't know" is a real signal (unlike a skipped question), so
  // the scorer is told which one it is.
  if (raw === NOT_SURE) return "(learner answered: I don't know)";
  return raw;
}

/** The request body for /api/diagnostic/evaluate. */
export function diagnosticAnswerPayload(diagnostic: DiagnosticSet, answers: Record<string, string>) {
  return diagnostic.questions.map((q) => ({
    prompt: q.prompt,
    type: q.type,
    subtopic: q.subtopic,
    answer: resolveAnswer(answers[q.id]),
  }));
}

/**
 * The placement quiz, shared by onboarding and "start a new topic". Answers
 * live in the parent so they survive a failed submission. Every question can
 * be answered "I don't know", and submitting with blanks asks for a
 * confirmation first - a skipped question silently counts against the
 * learner's estimated level, so it shouldn't happen by accident.
 */
export function DiagnosticQuestions({
  diagnostic,
  topic,
  answers,
  onAnswer,
  onSubmit,
  error,
  className,
}: {
  diagnostic: DiagnosticSet;
  topic: string;
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  onSubmit: () => void;
  error: string | null;
  className?: string;
}) {
  const { t } = useLocale();
  const [confirming, setConfirming] = useState(false);

  const isAnswered = (id: string) => (answers[id] ?? "").trim().length > 0;
  const answeredCount = diagnostic.questions.filter((q) => isAnswered(q.id)).length;
  const unanswered = diagnostic.questions.length - answeredCount;
  const subtopicCount = new Set(diagnostic.questions.map((q) => q.subtopic)).size;

  function handleSubmitClick() {
    if (unanswered > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    onSubmit();
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          {t.onboarding.diagnosticFor} — {topic}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{t.onboarding.diagnosticTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.onboarding.diagnosticSubtitle(diagnostic.questions.length, subtopicCount)}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={(answeredCount / diagnostic.questions.length) * 100} className="h-1.5 flex-1" />
          <span className="font-mono-tabular text-xs text-muted-foreground">
            {answeredCount} / {diagnostic.questions.length}
          </span>
        </div>
      </div>

      {diagnostic.questions.map((q, i) => {
        const notSure = answers[q.id] === NOT_SURE;
        return (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="font-mono text-xs text-muted-foreground">
                Q{i + 1} · {q.subtopic}
              </CardTitle>
              <CardDescription className="text-sm text-foreground/90">{q.prompt}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {q.codeSnippet && (
                <pre className="scrollbar-thin overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-xs">
                  {q.codeSnippet}
                </pre>
              )}
              {q.choices && q.choices.length > 0 ? (
                <ChoiceList
                  choices={q.choices}
                  value={answers[q.id] ?? ""}
                  onChange={(v) => onAnswer(q.id, v)}
                  label={`Q${i + 1}`}
                  secondary={{ value: NOT_SURE, label: t.onboarding.notSure }}
                />
              ) : (
                <>
                  <Textarea
                    placeholder={t.onboarding.questionAnswerPlaceholder}
                    aria-label={`Q${i + 1}`}
                    value={notSure ? "" : (answers[q.id] ?? "")}
                    disabled={notSure}
                    onChange={(e) => onAnswer(q.id, e.target.value)}
                    rows={3}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2 text-xs", !notSure && "text-muted-foreground")}
                    aria-pressed={notSure}
                    onClick={() => onAnswer(q.id, notSure ? "" : NOT_SURE)}
                  >
                    {t.onboarding.notSure}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {confirming && unanswered > 0 && (
        <p role="alert" className="rounded-md border border-mastery-medium/40 bg-mastery-medium/6 px-3 py-2 text-sm">
          {t.onboarding.unansweredWarning(unanswered)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        {confirming && unanswered > 0 && (
          <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
            {t.onboarding.keepAnswering}
          </Button>
        )}
        <Button onClick={handleSubmitClick} className="flex-1">
          {confirming && unanswered > 0 ? t.onboarding.submitAnyway : t.onboarding.submitDiagnostic}
        </Button>
      </div>
    </div>
  );
}
