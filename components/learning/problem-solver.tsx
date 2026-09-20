"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, Loader2 } from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";
import type { AttemptReward, ClientExercise, ExerciseType, SkillLevel } from "@/types/domain";
import type { Evaluation, Hint, TranslatedExercise } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ExerciseEditor } from "@/components/learning/exercise-editor";
import { ReadOnlyCode } from "@/components/learning/read-only-code";
import { FeedbackPanel, RewardStrip } from "@/components/learning/feedback-panel";
import { ChoiceList } from "@/components/learning/choice-list";
import { SolutionPanel, SolutionReveal } from "@/components/learning/solution-reveal";
import { collectTestResults } from "@/lib/js-tests";
import { useLocale } from "@/lib/i18n/locale-context";
import { useBatchContentTranslation } from "@/lib/i18n/use-content-translation";
import { useDraft } from "@/lib/drafts";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";

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

/** What survives a refresh: the work in progress, including hints already taken (they affect scoring). */
interface ProblemDraft {
  answer: string;
  hints: Hint[];
  solutionRevealed: boolean;
}

export function ProblemSolver({
  exerciseId,
  exercise,
  level,
}: {
  exerciseId: Id<"exercises">;
  exercise: ClientExercise;
  level?: SkillLevel;
}) {
  const { ready, draft, save, clear } = useDraft<ProblemDraft>(`exercise:${exerciseId}`);

  // The editors seed their content once, on mount - so wait until the stored
  // draft has been read instead of mounting empty and losing it.
  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;

  return <ProblemSolverBody exerciseId={exerciseId} exercise={exercise} level={level} initial={draft} save={save} clear={clear} />;
}

function ProblemSolverBody({
  exerciseId,
  exercise,
  level,
  initial,
  save,
  clear,
}: {
  exerciseId: Id<"exercises">;
  exercise: ClientExercise;
  level?: SkillLevel;
  initial: ProblemDraft | null;
  save: (draft: ProblemDraft) => void;
  clear: () => void;
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

  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [hintsUsed, setHintsUsed] = useState(initial?.hints.length ?? 0);
  const [visibleHints, setVisibleHints] = useState<Hint[]>(initial?.hints ?? []);
  const [solutionRevealed, setSolutionRevealed] = useState(initial?.solutionRevealed ?? false);
  const [solution, setSolution] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [reward, setReward] = useState<AttemptReward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);

  const isCodeAnswer = exercise.starterCode !== null && CODE_ANSWER_TYPES.has(exercise.type);
  const isReadOnlyCode = exercise.starterCode !== null && READ_ONLY_CODE_TYPES.has(exercise.type);
  const isMultipleChoice = exercise.type === "multiple_choice" && exercise.choices;

  useEffect(() => {
    if (answer || visibleHints.length > 0 || solutionRevealed) {
      save({ answer, hints: visibleHints, solutionRevealed });
    }
  }, [answer, visibleHints, solutionRevealed, save]);

  async function handleHint() {
    if (hintsUsed >= HINT_LEVELS.length) return;
    const level = HINT_LEVELS[hintsUsed];
    if (!level) return;
    setHintError(null);
    try {
      const data = await apiFetch<{ hint: Hint }>("/api/hint", {
        exerciseId,
        hintLevel: level,
        learnerAttemptSoFar: answer || null,
      });
      setVisibleHints((prev) => [...prev, data.hint]);
      setHintsUsed((n) => n + 1);
    } catch (e) {
      // Non-fatal (they can keep working), but say so - a button that
      // silently does nothing reads as broken.
      setHintError(apiErrorMessage(e, t, t.session.couldNotGetHint));
    }
  }

  // Ctrl/Cmd+Enter submits from anywhere on the exercise, including inside the
  // code editor. Captured before CodeMirror sees it, since its own Mod-Enter
  // binding would insert a blank line.
  function submitOnModEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim() && !submitting) {
      e.preventDefault();
      e.stopPropagation();
      void handleSubmit();
    }
  }

  async function handleSubmit() {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const testResults = isCodeAnswer ? await collectTestResults(exercise, answer) : null;
      const data = await apiFetch<{ evaluation: Evaluation; reward?: AttemptReward }>("/api/evaluate", {
        exerciseId,
        submittedAnswer: answer,
        testResults: testResults ?? undefined,
        hintsUsed,
        solutionRevealed,
        sessionId: null,
      });
      const result = data.evaluation;
      setEvaluation(result);
      setReward(data.reward ?? null);
      // Solved - nothing left worth restoring. An incorrect attempt keeps its
      // draft so the learner can pick the revision up after a refresh.
      if (result.result === "correct") clear();
    } catch (e) {
      setError(apiErrorMessage(e, t, t.session.couldNotEvaluate));
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
        <div className="space-y-6" onKeyDownCapture={submitOnModEnter}>
          {solution !== null && <SolutionPanel solution={solution} asCode={isCodeAnswer} language={exercise.language} />}

          {isMultipleChoice ? (
            <ChoiceList choices={choices!} value={answer} onChange={setAnswer} label={title} />
          ) : isCodeAnswer ? (
            <ExerciseEditor
              starterCode={exercise.starterCode ?? "// Write your solution here\n"}
              // Non-empty only when returning via "Revise and resubmit" — the
              // editor unmounts during feedback and would otherwise reset.
              initialCode={answer || undefined}
              onChange={setAnswer}
              language={exercise.language}
              previewMarkup={exercise.previewMarkup}
              testCases={exercise.testCases}
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
            <Button onClick={handleSubmit} disabled={submitting || !answer.trim()} title="Ctrl/⌘ + Enter">
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
            {solutionRevealed && <p className="text-xs text-muted-foreground">{t.session.solutionMarked}</p>}
          </div>
          {hintsUsed >= HINT_LEVELS.length && solution === null && (
            <p className="text-xs text-muted-foreground">{t.session.stuckNote}</p>
          )}
          {hintError && <p role="alert" className="text-sm text-destructive">{hintError}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {evaluation && (
        <div className="space-y-4">
          <FeedbackPanel evaluation={evaluation} exerciseId={exerciseId} compactScores={level === "beginner"} />
          {reward && <RewardStrip reward={reward} />}
          {solution !== null && <SolutionPanel solution={solution} asCode={isCodeAnswer} language={exercise.language} />}
          {evaluation.result !== "correct" && solution === null && (
            <SolutionReveal
              exerciseId={exerciseId}
              onLoaded={(s) => {
                setSolution(s);
                setSolutionRevealed(true);
              }}
            />
          )}
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
