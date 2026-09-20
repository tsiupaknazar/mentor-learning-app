"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRight, Lightbulb, BookOpen } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AttemptReward, ClientExercise, DailyTime, ExerciseType } from "@/types/domain";
import type { Concept, Evaluation, Hint } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/learning/code-editor";
import { ReadOnlyCode } from "@/components/learning/read-only-code";
import { ConceptPanel } from "@/components/learning/concept-panel";
import { FeedbackPanel, RewardStrip } from "@/components/learning/feedback-panel";
import { SessionSummary } from "@/components/learning/session-summary";
import { LoadingSteps } from "@/components/learning/loading-steps";
import { ChoiceList } from "@/components/learning/choice-list";
import { useLocale } from "@/lib/i18n/locale-context";
import { track } from "@/lib/analytics/track";
import { SESSION_TTL_MS, loadDraft, saveDraft, useDraft } from "@/lib/drafts";
import { EMPTY_ROUND_LOG, recordAttemptInLog, type RoundLog } from "@/lib/round-log";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { exercisesForDailyTime } from "@/lib/session-length";
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
  /**
   * The learner's stated daily time; sets how many exercises a session has
   * (lib/session-length.ts). Omit for the default of 5.
   */
  dailyTime?: DailyTime;
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
const SUBMIT_SHORTCUT_HINT = "Ctrl/⌘ + Enter";

/**
 * What's persisted so a refresh or closed tab can pick a practice session
 * back up. `exercise` is null between exercises (after feedback, before the
 * next one is generated) - resuming then just fetches the next exercise.
 */
interface SessionSnapshot {
  sessionId: string;
  completedCount: number;
  exercise: ClientExercise | null;
  exerciseId: string | null;
  answer: string;
  hints: Hint[];
  solutionRevealed: boolean;
  challengeMode: boolean;
  /** Absent in snapshots saved before the round summary existed. */
  log?: RoundLog;
  /** Session length it was started with; absent in older snapshots (then 5). */
  planned?: number;
}

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
  dailyTime,
  backHref = "/dashboard",
  backLabel,
}: SessionRunnerProps) {
  const { t, locale } = useLocale();
  const resolvedBackLabel = backLabel ?? (mode === "practice" ? t.session.backToPractice : t.session.backToDashboard);
  const isPractice = mode === "practice";
  const startSession = useMutation(api.sessions.startSession);
  const {
    ready: snapshotReady,
    draft: snapshot,
    save: saveSnapshot,
    clear: clearSnapshot,
  } = useDraft<SessionSnapshot>(`session:${mode}:${topicId}`, SESSION_TTL_MS);

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  // Fixed for the life of a session: a fresh one takes the learner's current
  // preference, a resumed one keeps the length it started with.
  const preferredLength = exercisesForDailyTime(dailyTime);
  const [planned, setPlanned] = useState(preferredLength);

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
  const [reward, setReward] = useState<AttemptReward | null>(null);
  const [log, setLog] = useState<RoundLog>(EMPTY_ROUND_LOG);
  const [hintError, setHintError] = useState<string | null>(null);

  // The concept overview is a Gemini call, and used to start only after the
  // learner clicked Start (then made them wait for it, every session). Now it
  // is requested as soon as the intro screen shows, so it's usually ready by
  // the time they click, and cached per topic + language so revisits are free.
  const conceptKey = `concept:${topicId}:${locale}`;
  const conceptRequest = useRef<Promise<Concept | null> | null>(null);
  const requestConcept = useCallback((): Promise<Concept | null> => {
    const cached = loadDraft<Concept>(conceptKey, SESSION_TTL_MS);
    if (cached) return Promise.resolve(cached);
    return apiFetch<{ concept: Concept }>("/api/concept", {
      topic: topicContextLabel ?? topicTitle,
      subtopic: topicTitle,
    })
      .then((data) => {
        saveDraft(conceptKey, data.concept);
        return data.concept;
      })
      .catch(() => null); // theory is optional; the caller decides what a miss means
  }, [conceptKey, topicContextLabel, topicTitle]);

  useEffect(() => {
    // Not for practice (no theory step), and not while an unfinished session
    // is on offer - most of those learners will resume rather than start over.
    if (isPractice || !snapshotReady || snapshot || conceptRequest.current) return;
    conceptRequest.current = requestConcept();
  }, [isPractice, snapshotReady, snapshot, requestConcept]);

  useEffect(() => {
    if (!sessionId) return;
    if (phase === "exercise" && exercise && exerciseId) {
      saveSnapshot({
        sessionId,
        completedCount,
        exercise,
        exerciseId,
        answer,
        hints: visibleHints,
        solutionRevealed,
        challengeMode,
        log,
        planned,
      });
    } else if (phase === "feedback") {
      // The attempt is recorded server-side; what's left to resume is the
      // *next* exercise, so bank this one as completed and drop its content.
      const done = completedCount + 1;
      if (done >= planned) {
        clearSnapshot();
      } else {
        saveSnapshot({
          sessionId,
          completedCount: done,
          exercise: null,
          exerciseId: null,
          answer: "",
          hints: [],
          solutionRevealed: false,
          challengeMode: false,
          log,
          planned,
        });
      }
    } else if (phase === "complete") {
      clearSnapshot();
    }
  }, [
    phase,
    sessionId,
    exercise,
    exerciseId,
    completedCount,
    answer,
    visibleHints,
    solutionRevealed,
    challengeMode,
    log,
    planned,
    saveSnapshot,
    clearSnapshot,
  ]);

  async function handleResume(saved: SessionSnapshot) {
    setSessionId(saved.sessionId as Id<"sessions">);
    setCompletedCount(saved.completedCount);
    setChallengeMode(saved.challengeMode);
    setPlanned(saved.planned ?? 5);
    setLog(saved.log ?? EMPTY_ROUND_LOG);
    // Bring back "Show theory" if the overview is still cached from earlier.
    const cachedConcept = isPractice ? null : loadDraft<Concept>(conceptKey, SESSION_TTL_MS);
    if (cachedConcept) setConcept(cachedConcept);
    setReward(null);
    if (saved.exercise && saved.exerciseId) {
      setExercise(saved.exercise);
      setExerciseId(saved.exerciseId as Id<"exercises">);
      setAnswer(saved.answer);
      setVisibleHints(saved.hints);
      setHintsUsed(saved.hints.length);
      setSolutionRevealed(saved.solutionRevealed);
      setShowTheory(false);
      setEvaluation(null);
      setError(null);
      setPhase("exercise");
    } else {
      await fetchExercise(saved.sessionId as Id<"sessions">, saved.challengeMode);
    }
  }

  async function fetchExercise(sid: Id<"sessions">, challenge = false) {
    setPhase("loading_exercise");
    setError(null);
    setAnswer("");
    setHintsUsed(0);
    setVisibleHints([]);
    setSolutionRevealed(false);
    setShowTheory(false);
    setEvaluation(null);
    setReward(null);
    setHintError(null);
    try {
      const data = await apiFetch<{ exercise: ClientExercise; exerciseId: string }>("/api/exercise", {
        topicId,
        sessionId: sid,
        challengeMode: challenge,
      });
      setExercise(data.exercise);
      setExerciseId(data.exerciseId as Id<"exercises">);
      setPhase("exercise");
    } catch (e) {
      setError(apiErrorMessage(e, t, t.session.couldNotGenerateExercise));
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
    const wasPrefetched = conceptRequest.current !== null;
    let loaded = await (conceptRequest.current ??= requestConcept());
    if (!loaded && wasPrefetched) {
      // The background attempt missed (e.g. a blip) - one more try now that
      // the learner is actually waiting on it.
      conceptRequest.current = requestConcept();
      loaded = await conceptRequest.current;
    }
    if (loaded) {
      setConcept(loaded);
      setPhase("concept");
    } else {
      // Theory is supplementary, not required — fall straight into practice
      // rather than blocking the whole session on it.
      await beginPractice();
    }
  }

  async function beginPractice() {
    setPhase("loading_exercise");
    // Every call starts a fresh session (also "Another round"), so the
    // per-session counters must start over too - otherwise round 2 would
    // finish after a single exercise.
    setCompletedCount(0);
    setChallengeMode(false);
    setLog(EMPTY_ROUND_LOG);
    setPlanned(preferredLength);
    try {
      const sid = await startSession({
        userId,
        topicId,
        objective: `Understand ${topicTitle} and apply it correctly.`,
        exercisesPlanned: preferredLength,
        // Only a finished "learn" session counts as having learned the topic; a
        // practice drill must not, or drilling ahead would advance the path.
        mode,
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

  async function handleSubmit() {
    if (!exerciseId || !sessionId || !answer.trim()) return;
    setPhase("submitting");
    setError(null);
    try {
      const data = await apiFetch<{ evaluation: Evaluation; reward?: AttemptReward }>("/api/evaluate", {
        exerciseId,
        submittedAnswer: answer,
        hintsUsed,
        solutionRevealed,
        sessionId,
      });
      const result = data.evaluation;
      const earned = data.reward ?? null;
      setEvaluation(result);
      setReward(earned);
      setLog((prev) =>
        recordAttemptInLog(prev, {
          exerciseId,
          title: exercise?.title ?? "",
          result: result.result,
          reward: earned,
          misconception: result.detectedMisconception,
        })
      );
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
      // Not the generic error screen: its "Try again" generates a brand-new
      // exercise, which would discard the learner's answer and hints. Go back
      // to the exercise (answer is restored by CodeEditor's initialCode) and
      // let Submit act as the retry.
      setError(apiErrorMessage(e, t, t.session.couldNotEvaluate));
      setPhase("exercise");
    }
  }

  // Ctrl/Cmd+Enter submits from anywhere on the exercise, including inside the
  // code editor. Captured before CodeMirror sees it, since its own Mod-Enter
  // binding would insert a blank line.
  function submitOnModEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim()) {
      e.preventDefault();
      e.stopPropagation();
      void handleSubmit();
    }
  }

  async function handleNext(challenge: boolean) {
    if (!sessionId) return;
    const next = completedCount + 1;
    setCompletedCount(next);
    if (next >= planned) {
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
        <Header topicTitle={topicTitle} completedCount={0} total={planned} mode={mode} t={t} />
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
            {dailyTime && (
              <p className="text-xs text-muted-foreground">
                {t.session.sizedFor(preferredLength, t.onboarding.times[dailyTime])}
              </p>
            )}
          </CardContent>
        </Card>
        {snapshotReady && snapshot && (
          <Card className="border-accent/40">
            <CardContent className="space-y-3 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent">{t.session.resumeTitle}</p>
              <p className="text-sm">{t.session.resumeDescription(snapshot.completedCount, snapshot.planned ?? 5)}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleResume(snapshot)}>
                  {t.session.resume}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearSnapshot();
                    handleStart();
                  }}
                >
                  {t.session.startOver}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleStart} size="lg" variant={snapshot ? "outline" : "default"}>
          {isPractice ? t.session.startPracticing : t.session.startSession}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );
  }

  if (phase === "loading_concept" || phase === "loading_exercise" || phase === "submitting") {
    const messages =
      phase === "loading_concept"
        ? [t.session.preparingConcept, ...t.session.conceptSteps]
        : phase === "submitting"
          ? [t.session.reviewingAnswer, ...t.session.reviewSteps]
          : [t.session.preparingExercise, ...t.session.exerciseSteps];
    // The review is the slow one: hint at its shape with a feedback skeleton.
    return <LoadingSteps key={phase} messages={messages} skeleton={phase === "submitting"} />;
  }

  if (phase === "concept" && concept) {
    return (
      <div className="space-y-6">
        <Header topicTitle={topicTitle} completedCount={0} total={planned} mode={mode} t={t} />
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
        <p role="alert" className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => (sessionId ? fetchExercise(sessionId) : handleStart())}>
          {t.common.tryAgain}
        </Button>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <SessionSummary
        log={log}
        topicTitle={topicTitle}
        exerciseCount={planned}
        backHref={backHref}
        backLabel={resolvedBackLabel}
        onAnotherRound={beginPractice}
      />
    );
  }

  if (phase === "feedback" && evaluation) {
    return (
      <div className="space-y-6">
        <Header topicTitle={topicTitle} completedCount={completedCount} total={planned} mode={mode} t={t} />
        <FeedbackPanel evaluation={evaluation} exerciseId={exerciseId ?? undefined} />
        {reward && <RewardStrip reward={reward} />}
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
      <div className="space-y-6" onKeyDownCapture={submitOnModEnter}>
        <Header topicTitle={topicTitle} completedCount={completedCount} total={planned} mode={mode} t={t} />

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
          <ChoiceList choices={exercise.choices!} value={answer} onChange={setAnswer} label={exercise.title} />
        ) : isCodeAnswer ? (
          <CodeEditor
            starterCode={exercise.starterCode ?? "// Write your solution here\n"}
            // Non-empty only when returning via "Revise and resubmit" — the
            // editor unmounts during feedback and would otherwise reset.
            initialCode={answer || undefined}
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
          <Button onClick={handleSubmit} disabled={!answer.trim()} title={SUBMIT_SHORTCUT_HINT}>
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
          {solutionRevealed && <p className="text-xs text-muted-foreground">{t.session.solutionMarked}</p>}
        </div>
        {hintError && <p role="alert" className="text-sm text-destructive">{hintError}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return null;
}

function Header({
  topicTitle,
  completedCount,
  total,
  mode = "learn",
  t,
}: {
  topicTitle: string;
  completedCount: number;
  total: number;
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
        {completedCount} / {total}
      </div>
    </div>
  );
}
