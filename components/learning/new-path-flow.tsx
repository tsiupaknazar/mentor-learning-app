"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Sparkles } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DiagnosticSet, KnowledgeProfile } from "@/lib/schemas";
import type { DailyTime, LearningGoal, LearningStyle, SkillLevel } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSteps } from "@/components/learning/loading-steps";
import {
  DiagnosticQuestions,
  diagnosticAnswerPayload,
} from "@/components/learning/diagnostic-questions";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";

type Step = "form" | "loading_diagnostic" | "diagnostic" | "scoring_diagnostic" | "generating_path" | "error";

export function NewPathFlow({
  userId,
  currentGoal,
  currentStyle,
  currentTime,
  suggestedTopics,
  triedTopics,
}: {
  userId: Id<"users">;
  currentGoal: LearningGoal;
  currentStyle: LearningStyle;
  currentTime: DailyTime;
  suggestedTopics: string[];
  triedTopics: string[];
}) {
  const router = useRouter();
  const { t } = useLocale();
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const LEVELS: { value: SkillLevel | "not_sure"; label: string }[] = (
    Object.keys(t.onboarding.levels) as (SkillLevel | "not_sure")[]
  ).map((value) => ({ value, label: t.onboarding.levels[value] }));
  const PRESET_TOPICS = t.onboarding.presetTopics;
  const CUSTOM_TOPIC_SENTINEL = PRESET_TOPICS[PRESET_TOPICS.length - 1]!;

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<SkillLevel | "not_sure">("beginner");
  const [topicChoice, setTopicChoice] = useState(PRESET_TOPICS[0] ?? "JavaScript");
  const [customTopic, setCustomTopic] = useState("");

  const [diagnostic, setDiagnostic] = useState<DiagnosticSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // The level/profile the path is being generated from - kept so that if path
  // generation fails, "Try again" retries it without redoing the diagnostic.
  const [pendingFinish, setPendingFinish] = useState<{ level: SkillLevel; profile: KnowledgeProfile | null } | null>(null);

  const resolvedTopic =
    topicChoice === CUSTOM_TOPIC_SENTINEL ? customTopic.trim() : topicChoice;

  function pickTopic(topic: string) {
    setCustomTopic(topic);
    setTopicChoice(CUSTOM_TOPIC_SENTINEL);
  }

  async function handleStart() {
    setError(null);
    if (!resolvedTopic) {
      setError(t.onboarding.enterTopicError);
      return;
    }

    if (level === "not_sure") {
      setStep("loading_diagnostic");
      try {
        const data = await apiFetch<{ diagnostic: DiagnosticSet }>("/api/diagnostic/questions", {
          topic: resolvedTopic,
          selfReportedLevel: "not_sure",
        });
        setDiagnostic(data.diagnostic);
        setAnswers({});
        setStep("diagnostic");
      } catch (e) {
        setError(apiErrorMessage(e, t, t.onboarding.couldNotGenerateDiagnostic));
        setStep("form");
      }
      return;
    }

    await finishNewPath(level, null);
  }

  async function handleSubmitDiagnostic() {
    if (!diagnostic) return;
    setStep("scoring_diagnostic");
    setError(null);
    try {
      const payload = diagnosticAnswerPayload(diagnostic, answers);
      const data = await apiFetch<{ profile: KnowledgeProfile }>("/api/diagnostic/evaluate", {
        topic: resolvedTopic,
        answers: payload,
      });
      const profile = data.profile;
      await finishNewPath(profile.suggestedLevel, profile);
    } catch (e) {
      // Scoring failed: the learner's answers are still in state, so send
      // them back to the questions (Submit is the retry) rather than to a
      // blank form that would regenerate different questions.
      setError(apiErrorMessage(e, t, t.onboarding.couldNotScoreDiagnostic));
      setStep("diagnostic");
    }
  }

  async function finishNewPath(resolvedLevel: SkillLevel, profile: KnowledgeProfile | null) {
    setPendingFinish({ level: resolvedLevel, profile });
    setStep("generating_path");
    setError(null);
    try {
      // Reuses completeOnboarding rather than a new mutation: it already
      // does exactly what's needed (persist level; onboardingComplete is
      // already true so re-setting it is a harmless no-op), and keeps the
      // existing goal/style/time untouched — those are whole-person
      // preferences, not per-topic ones.
      await completeOnboarding({
        userId,
        level: resolvedLevel,
        learningGoal: currentGoal,
        learningStyle: currentStyle,
        dailyTime: currentTime,
      });

      await apiFetch("/api/learning-path", { topic: resolvedTopic, knowledgeProfile: profile });

      router.push("/dashboard");
    } catch (e) {
      setError(apiErrorMessage(e, t, t.onboarding.couldNotGeneratePath));
      setStep("error");
    }
  }

  if (step === "loading_diagnostic" || step === "scoring_diagnostic" || step === "generating_path") {
    const messages =
      step === "loading_diagnostic"
        ? [t.onboarding.buildingDiagnostic, ...t.onboarding.diagnosticSteps]
        : step === "scoring_diagnostic"
          ? [t.onboarding.scoringAnswers, ...t.onboarding.scoringSteps]
          : [t.onboarding.generatingPath, ...t.onboarding.pathSteps];
    return <LoadingSteps key={step} messages={messages} />;
  }

  if (step === "diagnostic" && diagnostic) {
    return (
      <DiagnosticQuestions
        className="py-8"
        diagnostic={diagnostic}
        topic={resolvedTopic}
        answers={answers}
        onAnswer={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
        onSubmit={handleSubmitDiagnostic}
        error={error}
      />
    );
  }

  // Path generation failed after the level was settled: retry just that.
  if (step === "error" && pendingFinish) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => setStep("form")}>
            {t.common.back}
          </Button>
          <Button onClick={() => finishNewPath(pendingFinish.level, pendingFinish.profile)}>{t.common.tryAgain}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{t.newPath.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t.newPath.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.newPath.subtitle}</p>
      </div>

      {suggestedTopics.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            {t.newPath.suggestedNext}
          </Label>
          <div className="flex flex-wrap gap-2">
            {suggestedTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => pickTopic(topic)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  customTopic === topic && topicChoice === CUSTOM_TOPIC_SENTINEL
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-surface hover:bg-muted"
                )}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t.newPath.orPickAny}</Label>
        <Select value={topicChoice} onValueChange={setTopicChoice}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_TOPICS.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {tp}
                {triedTopics.some((tried) => tried.toLowerCase() === tp.toLowerCase())
                  ? ` ${t.newPath.alreadyTried}`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {topicChoice === CUSTOM_TOPIC_SENTINEL && (
          <Input
            placeholder={t.onboarding.customTopicPlaceholder}
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>{t.onboarding.levelLabel}</Label>
        <Select value={level} onValueChange={(v) => setLevel(v as SkillLevel | "not_sure")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleStart} className="w-full" size="lg">
        {level === "not_sure" ? t.onboarding.startDiagnostic : t.newPath.startButton}
      </Button>
    </div>
  );
}
