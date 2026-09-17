"use client";

import { useState } from "react";
import Link from "next/link";
import { Lightbulb, Loader2 } from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";
import type { ClientExercise, ExerciseType } from "@/types/domain";
import type { Evaluation, Hint, TranslatedExercise } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/learning/code-editor";
import { ReadOnlyCode } from "@/components/learning/read-only-code";
import { FeedbackPanel } from "@/components/learning/feedback-panel";
import { useLocale } from "@/lib/i18n/locale-context";
import { useBatchContentTranslation } from "@/lib/i18n/use-content-translation";

const HINT_LEVELS: Hint["level"][] = ["direction", "specific_problem", "strong_hint"];

const CODE_ANSWER_TYPES = new Set<ExerciseType>([
  "code_completion",
  "debugging",
  "refactoring",
  "implementation",
  "optimize_code",
  "write_tests",
]);
const READ_ONLY_CODE_TYPES = new Set<ExerciseType>([
  "code_prediction",
  "explain_code",
  "find_the_bug",
  "compare_implementations",
  "review_code",
]);

const DIFFICULTY_VARIANT = { easy: "strong", medium: "medium", hard: "weak" } as const;

export function ProblemSolver({
  exerciseId,
  exercise,
}: {
  exerciseId: Id<"exercises">;
  exercise: ClientExercise;
}) {
  const { t } = useLocale();

  const translatedById = useBatchContentTranslation<TranslatedExercise>(
    "/api/translate/exercise",
    "exerciseIds",
    [{ id: exerciseId, contentLocale: exercise.contentLocale }]
  );
  const translated = translatedById[exerciseId] ?? null;
  const title = translated?.title ?? exercise.title;
  const prompt = translated?.prompt ?? exercise.prompt;
  const choices = translated?.choices ?? exercise.choices;

  const [answer, setAnswer] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [visibleHints, setVisibleHints] = useState<Hint[]>([]);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCodeAnswer = exercise.starterCode !== null && CODE_ANSWER_TYPES.has(exercise.type);
  const isReadOnlyCode = exercise.starterCode !== null && READ_ONLY_CODE_TYPES.has(exercise.type);
  const isMultipleChoice = exercise.type === "multiple_choice" && exercise.choices;

  async function handleHint() {
    if (hintsUsed >= HINT_LEVELS.length) return;
    const level = HINT_LEVELS[hintsUsed];
    if (!level) return;
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, hintLevel: level, learnerAttemptSoFar: answer || null }),
      });
      if (!res.ok) throw new Error("Could not get a hint.");
      const data = await res.json();
      setVisibleHints((prev) => [...prev, data.hint as Hint]);
      setHintsUsed((n) => n + 1);
    } catch {
      // Non-fatal — the learner can just keep working without the hint.
    }
  }

  async function handleSubmit() {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId,
          submittedAnswer: answer,
          hintsUsed,
          solutionRevealed,
          sessionId: null,
        }),
      });
      if (!res.ok) throw new Error(t.session.couldNotEvaluate);
      const data = await res.json();
      setEvaluation(data.evaluation as Evaluation);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.somethingWentWrong);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/practice" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← {t.practice.backToBoard}
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={DIFFICULTY_VARIANT[exercise.difficulty as "easy" | "medium" | "hard"] ?? "weak"}>
              {t.practice.difficultyLabels[exercise.difficulty as "easy" | "medium" | "hard"] ?? exercise.difficulty}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {t.exercise.typeLabels[exercise.type as keyof typeof t.exercise.typeLabels] ?? exercise.type.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">{exercise.topic}</Badge>
          </div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{prompt}</p>
        </CardContent>
      </Card>

      {isReadOnlyCode && exercise.starterCode && (
        <ReadOnlyCode code={exercise.starterCode} language={exercise.language} />
      )}

      {!evaluation && (
        <>
          {isMultipleChoice ? (
            <div className="grid gap-2">
              {choices!.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setAnswer(choice)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    answer === choice
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-surface hover:bg-muted"
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : isCodeAnswer ? (
            <CodeEditor
              starterCode={exercise.starterCode ?? "// Write your solution here\n"}
              onChange={setAnswer}
              language={exercise.language}
            />
          ) : (
            <Textarea
              placeholder={isReadOnlyCode ? t.session.explainReasoningPlaceholder : t.session.writeAnswerPlaceholder}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={isReadOnlyCode ? 5 : 8}
            />
          )}

          {visibleHints.length > 0 && (
            <div className="space-y-2">
              {visibleHints.map((h, i) => (
                <div key={i} className="rounded-md border border-accent/25 bg-accent/5 p-3">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-accent">
                    {t.session.hintLabel(i + 1)} · {t.exercise.hintLevelLabels[h.level] ?? h.level.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-sm text-foreground/90">{h.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSubmit} disabled={submitting || !answer.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t.session.reviewingAnswer}
                </>
              ) : (
                t.session.submitAnswer
              )}
            </Button>
            <Button variant="ghost" onClick={handleHint} disabled={hintsUsed >= HINT_LEVELS.length}>
              <Lightbulb className="h-4 w-4" aria-hidden />
              {hintsUsed >= HINT_LEVELS.length ? t.session.noMoreHints : t.session.hint(hintsUsed, HINT_LEVELS.length)}
            </Button>
            {hintsUsed >= HINT_LEVELS.length && !solutionRevealed && (
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setSolutionRevealed(true)}>
                {t.session.markSolutionRevealed}
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}

      {evaluation && (
        <div className="space-y-4">
          <FeedbackPanel evaluation={evaluation} exerciseId={exerciseId} />
          <div className="flex flex-wrap gap-3">
            {evaluation.result !== "correct" && (
              <Button variant="outline" onClick={() => setEvaluation(null)}>
                {t.session.reviseAndResubmit}
              </Button>
            )}
            <Button asChild>
              <Link href="/practice">{t.practice.backToBoard}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
