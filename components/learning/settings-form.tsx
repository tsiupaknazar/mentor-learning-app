"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Check } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DailyTime, LearningGoal, LearningStyle, Locale, Specialty, SkillLevel } from "@/types/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/i18n/locale-context";
import { levelLabel } from "@/lib/i18n/dictionaries";

interface SettingsFormProps {
  userId: Id<"users">;
  email: string;
  level: SkillLevel;
  learningGoal: LearningGoal;
  learningStyle: LearningStyle;
  dailyTime: DailyTime;
  specialty: Specialty;
}

export function SettingsForm(props: SettingsFormProps) {
  const { t, locale, setLocale } = useLocale();
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [goal, setGoal] = useState(props.learningGoal);
  const [style, setStyle] = useState(props.learningStyle);
  const [time, setTime] = useState(props.dailyTime);
  const [specialty, setSpecialty] = useState(props.specialty);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const GOALS: { value: LearningGoal; label: string }[] = (
    Object.keys(t.onboarding.goals) as LearningGoal[]
  ).map((value) => ({ value, label: t.onboarding.goals[value] }));
  const STYLES: { value: LearningStyle; label: string }[] = (
    Object.keys(t.onboarding.styles) as LearningStyle[]
  ).map((value) => ({ value, label: t.onboarding.styles[value] }));
  const TIMES: { value: DailyTime; label: string }[] = (
    Object.keys(t.onboarding.times) as DailyTime[]
  ).map((value) => ({ value, label: t.onboarding.times[value] }));
  const LOCALES: { value: Locale; label: string }[] = (
    Object.keys(t.settings.languageNames) as Locale[]
  ).map((value) => ({ value, label: t.settings.languageNames[value] }));
  const SPECIALTIES: { value: Specialty; label: string }[] = (
    Object.keys(t.onboarding.specialties) as Specialty[]
  ).map((value) => ({ value, label: t.onboarding.specialties[value] }));

  // The select has already switched by the time this runs, so a failed save
  // must switch it back (`revert`) - otherwise the form shows a setting that
  // was never stored, and nothing says so.
  async function save(
    patch: Partial<{
      learningGoal: LearningGoal;
      learningStyle: LearningStyle;
      dailyTime: DailyTime;
      specialty: Specialty;
    }>,
    revert: () => void
  ) {
    setSaveError(null);
    try {
      await updatePreferences({ userId: props.userId, ...patch });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    } catch {
      revert();
      setSaved(false);
      setSaveError(t.settings.couldNotSave);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-1 p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.settings.account}</p>
          <p className="text-sm">{props.email}</p>
          <div className="pt-1">
            <Badge variant="outline">{levelLabel(t, props.level)}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2">
            <Label>{t.settings.learningGoal}</Label>
            <Select
              value={goal}
              onValueChange={(v) => {
                const previous = goal;
                setGoal(v as LearningGoal);
                void save({ learningGoal: v as LearningGoal }, () => setGoal(previous));
              }}
            >
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
            <Label>{t.settings.learningStyle}</Label>
            <Select
              value={style}
              onValueChange={(v) => {
                const previous = style;
                setStyle(v as LearningStyle);
                void save({ learningStyle: v as LearningStyle }, () => setStyle(previous));
              }}
            >
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
            <Label>{t.settings.availableTime}</Label>
            <Select
              value={time}
              onValueChange={(v) => {
                const previous = time;
                setTime(v as DailyTime);
                void save({ dailyTime: v as DailyTime }, () => setTime(previous));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMES.map((t2) => (
                  <SelectItem key={t2.value} value={t2.value}>
                    {t2.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.settings.availableTimeHint}</p>
          </div>

          <div className="space-y-2">
            <Label>{t.settings.specialty}</Label>
            <Select
              value={specialty}
              onValueChange={(v) => {
                const previous = specialty;
                setSpecialty(v as Specialty);
                void save({ specialty: v as Specialty }, () => setSpecialty(previous));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.settings.language}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {saved && (
            <p role="status" className="flex items-center gap-1.5 text-xs text-mastery-strong">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {t.common.saved}
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-xs text-destructive">
              {saveError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
