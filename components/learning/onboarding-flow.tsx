"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { ChevronDown } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DiagnosticSet, KnowledgeProfile } from "@/lib/schemas";
import type { DailyTime, LearningGoal, LearningStyle, Locale, SkillLevel } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSteps } from "@/components/learning/loading-steps";
import {
  DiagnosticQuestions,
  diagnosticAnswerPayload,
} from "@/components/learning/diagnostic-questions";
import { useLocale } from "@/lib/i18n/locale-context";
import { track } from "@/lib/analytics/track";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Step =
  | "form"
  | "loading_diagnostic"
  | "diagnostic"
  | "scoring_diagnostic"
  | "generating_path"
  | "error";

export function OnboardingFlow({ userId }: { userId: Id<"users"> }) {
  const router = useRouter();
  const { t, locale, setLocale } = useLocale();
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const GOALS: { value: LearningGoal; label: string }[] = (
    Object.keys(t.onboarding.goals) as LearningGoal[]
  ).map((value) => ({ value, label: t.onboarding.goals[value] }));
  const LEVELS: { value: SkillLevel | "not_sure"; label: string }[] = (
    Object.keys(t.onboarding.levels) as (SkillLevel | "not_sure")[]
  ).map((value) => ({ value, label: t.onboarding.levels[value] }));
  const STYLES: { value: LearningStyle; label: string }[] = (
    Object.keys(t.onboarding.styles) as LearningStyle[]
  ).map((value) => ({ value, label: t.onboarding.styles[value] }));
  const TIMES: { value: DailyTime; label: string }[] = (
    Object.keys(t.onboarding.times) as DailyTime[]
  ).map((value) => ({ value, label: t.onboarding.times[value] }));
  const PRESET_TOPICS = t.onboarding.presetTopics;
  const CUSTOM_TOPIC_SENTINEL = PRESET_TOPICS[PRESET_TOPICS.length - 1]!; // "Custom topic…" localized
  const LOCALES: { value: Locale; short: string }[] = [
    { value: "en", short: "EN" },
    { value: "uk", short: "UK" },
  ];

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  const [goal, setGoal] = useState<LearningGoal>("improve_skills");
  const [level, setLevel] = useState<SkillLevel | "not_sure">("beginner");
  const [style, setStyle] = useState<LearningStyle>("balanced");
  const [time, setTime] = useState<DailyTime>("30min");
  const [topicChoice, setTopicChoice] = useState(PRESET_TOPICS[0] ?? "JavaScript");
  const [customTopic, setCustomTopic] = useState("");

  const [diagnostic, setDiagnostic] = useState<DiagnosticSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // The level/profile the path is being generated from - kept so that if path
  // generation fails, "Try again" retries it without redoing the diagnostic.
  const [pendingFinish, setPendingFinish] = useState<{ level: SkillLevel; profile: KnowledgeProfile | null } | null>(null);

  const resolvedTopic = topicChoice === CUSTOM_TOPIC_SENTINEL ? customTopic.trim() : topicChoice;

  async function handleStartLearning() {
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

    await finishOnboarding(level, null);
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
      await finishOnboarding(profile.suggestedLevel, profile);
    } catch (e) {
      // Scoring failed: the learner's answers are still in state, so send
      // them back to the questions (Submit is the retry) rather than to a
      // blank form that would regenerate different questions.
      setError(apiErrorMessage(e, t, t.onboarding.couldNotScoreDiagnostic));
      setStep("diagnostic");
    }
  }

  async function finishOnboarding(resolvedLevel: SkillLevel, profile: KnowledgeProfile | null) {
    setPendingFinish({ level: resolvedLevel, profile });
    setStep("generating_path");
    setError(null);
    try {
      await completeOnboarding({
        userId,
        level: resolvedLevel,
        learningGoal: goal,
        learningStyle: style,
        dailyTime: time,
      });

      await apiFetch("/api/learning-path", { topic: resolvedTopic, knowledgeProfile: profile });

      track("onboarding_completed", {
        level: resolvedLevel,
        goal,
        learningStyle: style,
        dailyTime: time,
        topic: resolvedTopic,
      });

      router.push("/dashboard");
    } catch (e) {
      setError(apiErrorMessage(e, t, t.onboarding.couldNotGeneratePath));
      setStep("error");
    }
  }

  const languageSwitcher = (
    <div className="mb-6 flex justify-end gap-1">
      {LOCALES.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setLocale(l.value)}
          className={cn(
            "rounded px-2 py-1 font-mono text-xs transition-colors",
            locale === l.value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          aria-pressed={locale === l.value}
        >
          {l.short}
        </button>
      ))}
    </div>
  );

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
        className=""
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
          <Button onClick={() => finishOnboarding(pendingFinish.level, pendingFinish.profile)}>{t.common.tryAgain}</Button>
        </div>
      </div>
    );
  }

  const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) =>
    options.find((o) => o.value === value)?.label ?? value;
  const preferencesSummary = [labelOf(GOALS, goal), labelOf(STYLES, style), labelOf(TIMES, time)].join(" \u00b7 ");

  return (
    <div className="space-y-8">
      {languageSwitcher}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{t.onboarding.setUp}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t.onboarding.title}</h1>
      </div>

      {/* What actually shapes the path comes first: the topic and where the learner starts. */}
      <div className="space-y-2">
        <Label>{t.onboarding.topicLabel}</Label>
        <Select value={topicChoice} onValueChange={setTopicChoice}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_TOPICS.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {tp}
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

      {/* Goal / style / time have sensible defaults - out of the way, but one click from changing. */}
      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setShowPreferences((v) => !v)}
          aria-expanded={showPreferences}
          aria-controls="onboarding-preferences"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium">{t.onboarding.personalize}</span>
            <span className="block text-xs text-muted-foreground">
              {showPreferences ? t.onboarding.personalizeHint : preferencesSummary}
            </span>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", showPreferences && "rotate-180")}
            aria-hidden
          />
        </button>
        {showPreferences && (
          <div id="onboarding-preferences" className="space-y-6 border-t border-border p-4">
            <div className="space-y-2">
              <Label>{t.onboarding.goalLabel}</Label>
              <Select value={goal} onValueChange={(v) => setGoal(v as LearningGoal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.onboarding.styleLabel}</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as LearningStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.onboarding.timeLabel}</Label>
              <Select value={time} onValueChange={(v) => setTime(v as DailyTime)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMES.map((tm) => (
                    <SelectItem key={tm.value} value={tm.value}>
                      {tm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={handleStartLearning} className="w-full" size="lg">
        {level === "not_sure" ? t.onboarding.startDiagnostic : t.onboarding.generatePath}
      </Button>
    </div>
  );
}
