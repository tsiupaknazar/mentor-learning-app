"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DiagnosticSet, KnowledgeProfile } from "@/lib/schemas";
import type { DailyTime, LearningGoal, LearningStyle, Locale, SkillLevel } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/lib/i18n/locale-context";
import { track } from "@/lib/analytics/track";
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

  const [goal, setGoal] = useState<LearningGoal>("improve_skills");
  const [level, setLevel] = useState<SkillLevel | "not_sure">("beginner");
  const [style, setStyle] = useState<LearningStyle>("balanced");
  const [time, setTime] = useState<DailyTime>("30min");
  const [topicChoice, setTopicChoice] = useState(PRESET_TOPICS[0] ?? "JavaScript");
  const [customTopic, setCustomTopic] = useState("");

  const [diagnostic, setDiagnostic] = useState<DiagnosticSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
        const res = await fetch("/api/diagnostic/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: resolvedTopic, selfReportedLevel: "not_sure" }),
        });
        if (!res.ok) throw new Error(t.onboarding.couldNotGenerateDiagnostic);
        const data = await res.json();
        setDiagnostic(data.diagnostic as DiagnosticSet);
        setStep("diagnostic");
      } catch (e) {
        setError(e instanceof Error ? e.message : t.onboarding.genericError);
        setStep("error");
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
      const payload = diagnostic.questions.map((q) => ({
        prompt: q.prompt,
        type: q.type,
        subtopic: q.subtopic,
        answer: answers[q.id] ?? "(no answer given)",
      }));
      const res = await fetch("/api/diagnostic/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: resolvedTopic, answers: payload }),
      });
      if (!res.ok) throw new Error(t.onboarding.couldNotScoreDiagnostic);
      const data = await res.json();
      const profile = data.profile as KnowledgeProfile;
      await finishOnboarding(profile.suggestedLevel, profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.onboarding.genericError);
      setStep("error");
    }
  }

  async function finishOnboarding(resolvedLevel: SkillLevel, profile: KnowledgeProfile | null) {
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

      const res = await fetch("/api/learning-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: resolvedTopic, knowledgeProfile: profile }),
      });
      if (!res.ok) throw new Error(t.onboarding.couldNotGeneratePath);

      track("onboarding_completed", {
        level: resolvedLevel,
        goal,
        learningStyle: style,
        dailyTime: time,
        topic: resolvedTopic,
      });

      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.onboarding.genericError);
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
    const label =
      step === "loading_diagnostic"
        ? t.onboarding.buildingDiagnostic
        : step === "scoring_diagnostic"
          ? t.onboarding.scoringAnswers
          : t.onboarding.generatingPath;
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
        <p className="font-mono text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  if (step === "diagnostic" && diagnostic) {
    const answeredCount = diagnostic.questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
    const subtopicCount = new Set(diagnostic.questions.map((q) => q.subtopic)).size;

    return (
      <div className="space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            {t.onboarding.diagnosticFor} — {resolvedTopic}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{t.onboarding.diagnosticTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.onboarding.diagnosticSubtitle(diagnostic.questions.length, subtopicCount)}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Progress
              value={(answeredCount / diagnostic.questions.length) * 100}
              className="h-1.5 flex-1"
            />
            <span className="font-mono-tabular text-xs text-muted-foreground">
              {answeredCount} / {diagnostic.questions.length}
            </span>
          </div>
        </div>

        {diagnostic.questions.map((q, i) => (
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
                <div className="grid gap-2">
                  {q.choices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: choice }))}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        answers[q.id] === choice
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border bg-surface hover:bg-muted"
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : (
                <Textarea
                  placeholder={t.onboarding.questionAnswerPlaceholder}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={3}
                />
              )}
            </CardContent>
          </Card>
        ))}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmitDiagnostic} className="w-full">
          {t.onboarding.submitDiagnostic}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {languageSwitcher}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{t.onboarding.setUp}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t.onboarding.title}</h1>
      </div>

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
        <Label>{t.onboarding.styleLabel}</Label>
        <Select value={style} onValueChange={(v) => setStyle(v as LearningStyle)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleStartLearning} className="w-full" size="lg">
        {level === "not_sure" ? t.onboarding.startDiagnostic : t.onboarding.generatePath}
      </Button>
    </div>
  );
}
