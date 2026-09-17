"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRight, Loader2, Lightbulb, Sparkles, BookOpen } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClientExercise, ExerciseType } from "@/types/domain";
import type { Concept, Evaluation, Hint } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/learning/code-editor";
import { ReadOnlyCode } from "@/components/learning/read-only-code";
import { ConceptPanel } from "@/components/learning/concept-panel";
import { FeedbackPanel } from "@/components/learning/feedback-panel";
import { useLocale } from "@/lib/i18n/locale-context";
import { track } from "@/lib/analytics/track";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface SessionRunnerProps {
  userId: Id<"users">;
  topicId: Id<"topics">;
  topicTitle: string;
  topicSummary: string;
  masteryOverall: number;
  /**
   * The broader context this topic sits within — its immediate parent
   * topic's title (e.g. "Functions" for a "Closures" child topic), or the
   * learning path's own subject for a root topic with no parent. Passed
   * to /api/concept as "topic" (with topicTitle as "subtopic") so the
   * generated overview actually reflects where this topic sits in the
   * tree, instead of the same title being sent twice. Falls back to
   * topicTitle if not provided.
   */
  topicContextLabel?: string;
  /**
   * "learn" (default) runs the full flow: concept/theory overview first,
   * then exercises. "practice" skips the concept step entirely and drops
   * straight into generating exercises — the Practice page is for drilling
   * a topic, not for reading a lesson.
   */
  mode?: "learn" | "practice";
  /** Where "Back to dashboard" / completion actions should return to. */
  backHref?: string;
  backLabel?: string;
}

type Phase =
  | "intro"
  | "loading_concept"
  | "concept"
  | "loading_exercise"
  | "exercise"
  | "submitting"
  | "feedback"
  | "complete"
  | "error";

const HINT_LEVELS: Hint["level"][] = ["direction", "specific_problem", "strong_hint"];
const EXERCISES_PER_SESSION = 5;

/**
 * Exercise types where the learner writes or edits code — the code editor's
 * contents ARE the submitted answer.
 */
const CODE_ANSWER_TYPES = new Set<ExerciseType>([
  "code_completion",
  "debugging",
  "refactoring",
  "implementation",
  "optimize_code",
  "write_tests",
]);

/**
 * Exercise types where code is shown as reference material to read and
 * reason about — the learner's answer is a separate text explanation, not
 * an edit to the code itself. This was the bug reported: these types were
 * previously rendered with an editable code box, so "submit" meant
 * "whatever you typed into the code", which is meaningless for e.g.
 * predicting an output or explaining why code behaves a certain way.
 */
const READ_ONLY_CODE_TYPES = new Set<ExerciseType>([
  "code_prediction",
  "explain_code",
  "find_the_bug",
  "compare_implementations",
  "review_code",
]);

export function SessionRunner({
  userId,
  topicId,
  topicTitle,
  topicSummary,
  masteryOverall,
  topicContextLabel,
  mode = "learn",
  backHref = "/dashboard",
  backLabel,
}: SessionRunnerProps) {
  const { t } = useLocale();
  const resolvedBackLabel = backLabel ?? (mode === "practice" ? t.session.backToPractice : t.session.backToDashboard);
  const isPractice = mode === "practice";
  const startSession = useMutation(api.sessions.startSession);

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  const [concept, setConcept] = useState<Concept | null>(null);
  const [showTheory, setShowTheory] = useState(false);

  const [exercise, setExercise] = useState<ClientExercise | null>(null);
  const [exerciseId, setExerciseId] = useState<Id<"exercises"> | null>(null);
  const [answer, setAnswer] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [visibleHints, setVisibleHints] = useState<Hint[]>([]);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [challengeMode, setChallengeMode] = useState(false);

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  async function fetchExercise(sid: Id<"sessions">, challenge = false) {
    setPhase("loading_exercise");
    setError(null);
    setAnswer("");
    setHintsUsed(0);
    setVisibleHints([]);
    setSolutionRevealed(false);
    setShowTheory(false);
    setEvaluation(null);
    try {
      const res = await fetch("/api/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, sessionId: sid, challengeMode: challenge }),
      });
      if (!res.ok) throw new Error(t.session.couldNotGenerateExercise);
      const data = await res.json();
      setExercise(data.exercise as ClientExercise);
      setExerciseId(data.exerciseId as Id<"exercises">);
      setPhase("exercise");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.somethingWentWrong);
      setPhase("error");
    }
  }

  async function handleStart() {
    // Practice is exercises-only — no concept/theory step, straight into drilling.
    if (isPractice) {
      await beginPractice();
      return;
    }
    setPhase("loading_concept");
    setError(null);
    try {
      const res = await fetch("/api/concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicContextLabel ?? topicTitle, subtopic: topicTitle }),
      });
      if (!res.ok) throw new Error("Could not prepare the concept overview.");
      const data = await res.json();
      setConcept(data.concept as Concept);
      setPhase("concept");
    } catch {
      // Theory is supplementary, not required — fall straight into practice
      // rather than blocking the whole session on it.
      await beginPractice();
    }
  }

  async function beginPractice() {
    setPhase("loading_exercise");
    try {
      const sid = await startSession({
        userId,
        topicId,
        objective: `Understand ${topicTitle} and apply it correctly.`,
        exercisesPlanned: EXERCISES_PER_SESSION,
      });
      setSessionId(sid);
      await fetchExercise(sid);
    } catch {
      setError(t.session.couldNotStartSession);
      setPhase("error");
    }
  }

  async function handleHint() {
    if (!exerciseId || hintsUsed >= HINT_LEVELS.length) return;
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
    if (!exerciseId || !sessionId || !answer.trim()) return;
    setPhase("submitting");
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
          sessionId,
        }),
      });
      if (!res.ok) throw new Error(t.session.couldNotEvaluate);
      const data = await res.json();
      const result = data.evaluation as Evaluation;
      setEvaluation(result);
      setPhase("feedback");

      track("exercise_submitted", {
        topic: topicContextLabel ?? topicTitle,
        subtopic: topicTitle,
        difficulty: exercise?.difficulty,
        exerciseType: exercise?.type,
        result: result.result,
        hintsUsed,
        solutionRevealed,
        mode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.somethingWentWrong);
      setPhase("error");
    }
  }

  async function handleNext(challenge: boolean) {
    if (!sessionId) return;
    const next = completedCount + 1;
    setCompletedCount(next);
    if (next >= EXERCISES_PER_SESSION) {
      setPhase("complete");
      return;
    }
    setChallengeMode(challenge);
    await fetchExercise(sessionId, challenge);
  }

  // ---------------------------------------------------------------------
  if (phase === "intro") {
    return (
      <div className="space-y-6">
        <Header topicTitle={topicTitle} completedCount={0} mode={mode} t={t} />
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-accent">
              {isPractice ? t.session.drilling : t.session.todaysObjective}
            </p>
            <p className="text-lg font-medium">
              {isPractice ? t.session.practiceObjective(topicTitle) : t.session.learnObjective(topicTitle)}
            </p>
            <p className="text-sm text-muted-foreground">{topicSummary}</p>
            {masteryOverall > 0 && (
              <p className="text-xs text-muted-foreground">{t.session.currentMastery(masteryOverall)}</p>
            )}
          </CardContent>
        </Card>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleStart} size="lg">
          {isPractice ? t.session.startPracticing : t.session.startSession}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );
  }

  if (phase === "loading_concept" || phase === "loading_exercise" || phase === "submitting") {
    const label =
      phase === "loading_concept"
        ? t.session.preparingConcept
        : phase === "submitting"
          ? t.session.reviewingAnswer
          : t.session.preparingExercise;
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
        <p className="font-mono text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  if (phase === "concept" && concept) {
    return (
      <div className="space-y-6">
        <Header topicTitle={topicTitle} completedCount={0} mode={mode} t={t} />
        <ConceptPanel concept={concept} />
        <Button onClick={beginPractice} size="lg">
          {t.session.startPracticingButton}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => (sessionId ? fetchExercise(sessionId) : handleStart())}>
          {t.common.tryAgain}
        </Button>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="space-y-6 py-12 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-accent" aria-hidden />
        <h2 className="text-xl font-semibold">{t.session.sessionComplete}</h2>
        <p className="text-sm text-muted-foreground">
          {t.session.exercisesReviewed(EXERCISES_PER_SESSION, topicTitle)}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={handleStart}>
            {t.session.anotherRound}
          </Button>
          <Button asChild>
            <a href={backHref}>{resolvedBackLabel}</a>
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "feedback" && evaluation) {
    return (
      <div className="space-y-6">
        <Header topicTitle={topicTitle} completedCount={completedCount} mode={mode} t={t} />
        <FeedbackPanel evaluation={evaluation} exerciseId={exerciseId ?? undefined} />
        <div className="flex flex-wrap gap-3">
          {evaluation.result !== "correct" && (
            <Button variant="outline" onClick={() => setPhase("exercise")}>
              {t.session.reviseAndResubmit}
            </Button>
          )}
          <Button onClick={() => handleNext(false)}>
            {t.session.nextExercise}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          {evaluation.result === "correct" && (
            <Button variant="secondary" onClick={() => handleNext(true)}>
              {t.session.harderVariation}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "exercise" && exercise) {
    const isCodeAnswer = exercise.starterCode !== null && CODE_ANSWER_TYPES.has(exercise.type);
    const isReadOnlyCode = exercise.starterCode !== null && READ_ONLY_CODE_TYPES.has(exercise.type);
    const isMultipleChoice = exercise.type === "multiple_choice" && exercise.choices;

    return (
      <div className="space-y-6">
        <Header topicTitle={topicTitle} completedCount={completedCount} mode={mode} t={t} />

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {t.exercise.typeLabels[exercise.type as keyof typeof t.exercise.typeLabels] ?? exercise.type.replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {t.exercise.difficultyLabels[exercise.difficulty as keyof typeof t.exercise.difficultyLabels] ?? exercise.difficulty.replace(/_/g, " ")}
                </Badge>
                {challengeMode && <Badge variant="medium">{t.session.challenge}</Badge>}
              </div>
              {concept && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setShowTheory((v) => !v)}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden />
                  {showTheory ? t.session.hideTheory : t.session.showTheory}
                </Button>
              )}
            </div>
            <h2 className="text-lg font-semibold">{exercise.title}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {exercise.prompt}
            </p>
          </CardContent>
        </Card>

        {/* Revisit theory without leaving the exercise — for study/revision, not just first pass */}
        {showTheory && concept && <ConceptPanel concept={concept} />}

        {/* Reference code to read (predict/explain/find-the-bug/review/compare) — never the answer itself */}
        {isReadOnlyCode && exercise.starterCode && (
          <ReadOnlyCode code={exercise.starterCode} language={exercise.language} />
        )}

        {isMultipleChoice ? (
          <div className="grid gap-2">
            {exercise.choices!.map((choice) => (
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
              <div key={i} className="rounded-md border border-accent/25 bg-accent/[0.05] p-3">
                <p className="font-mono text-[11px] uppercase tracking-wide text-accent">
                  {t.session.hintLabel(i + 1)} · {t.exercise.hintLevelLabels[h.level] ?? h.level.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-sm text-foreground/90">{h.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={!answer.trim()}>
            {t.session.submitAnswer}
          </Button>
          <Button
            variant="ghost"
            onClick={handleHint}
            disabled={hintsUsed >= HINT_LEVELS.length}
          >
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
      </div>
    );
  }

  return null;
}

function Header({
  topicTitle,
  completedCount,
  mode = "learn",
  t,
}: {
  topicTitle: string;
  completedCount: number;
  mode?: "learn" | "practice";
  t: Dictionary;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {mode === "practice" ? t.session.practiceLabel : t.session.sessionLabel}
        </p>
        <h1 className="text-xl font-semibold">{topicTitle}</h1>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {completedCount} / {EXERCISES_PER_SESSION}
      </div>
    </div>
  );
}
