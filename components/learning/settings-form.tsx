"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Check } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DailyTime, LearningGoal, LearningStyle, Locale, SkillLevel } from "@/types/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/i18n/locale-context";

interface SettingsFormProps {
  userId: Id<"users">;
  email: string;
  level: SkillLevel;
  learningGoal: LearningGoal;
  learningStyle: LearningStyle;
  dailyTime: DailyTime;
}

export function SettingsForm(props: SettingsFormProps) {
  const { t, locale, setLocale } = useLocale();
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [goal, setGoal] = useState(props.learningGoal);
  const [style, setStyle] = useState(props.learningStyle);
  const [time, setTime] = useState(props.dailyTime);
  const [saved, setSaved] = useState(false);

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

  async function save(patch: Partial<{ learningGoal: LearningGoal; learningStyle: LearningStyle; dailyTime: DailyTime }>) {
    await updatePreferences({ userId: props.userId, ...patch });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-1 p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.settings.account}</p>
          <p className="text-sm">{props.email}</p>
          <div className="pt-1">
            <Badge variant="outline" className="capitalize">
              {props.level}
            </Badge>
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
                setGoal(v as LearningGoal);
                save({ learningGoal: v as LearningGoal });
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
                setStyle(v as LearningStyle);
                save({ learningStyle: v as LearningStyle });
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
                setTime(v as DailyTime);
                save({ dailyTime: v as DailyTime });
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
            <p className="flex items-center gap-1.5 text-xs text-mastery-strong">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {t.common.saved}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
