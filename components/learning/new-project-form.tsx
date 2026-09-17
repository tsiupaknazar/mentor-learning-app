"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import type { SkillLevel } from "@/types/domain";
import type { ProjectIdea } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-context";

const LEVELS: SkillLevel[] = ["beginner", "junior", "intermediate", "advanced"];

// "closed": just the start button. "ideas": browsing prepared suggestions
// (the default once opened). "custom": the original free-text topic form,
// reached either deliberately or as a fallback if idea generation fails.
type ViewState = "closed" | "ideas" | "custom";

export function NewProjectForm({ defaultLevel }: { defaultLevel: SkillLevel }) {
  const router = useRouter();
  const { t } = useLocale();
  const [view, setView] = useState<ViewState>("closed");
  const [level, setLevel] = useState<SkillLevel>(defaultLevel);

  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [loadedLevel, setLoadedLevel] = useState<SkillLevel | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState(false);
  // Bumped on every fetchIdeas call so a slower, older request can't
  // clobber a newer one's result if they land out of order (e.g. the
  // background prefetch below resolving after an explicit level-change
  // refetch already completed).
  const requestIdRef = useRef(0);

  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchIdeas(forLevel: SkillLevel) {
    const requestId = ++requestIdRef.current;
    setIdeasLoading(true);
    setIdeasError(false);
    try {
      const res = await fetch("/api/project/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: forLevel }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // superseded by a newer fetch
      setIdeas(data.ideas as ProjectIdea[]);
      setLoadedLevel(forLevel);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setIdeas([]);
      setIdeasError(true);
    } finally {
      if (requestId === requestIdRef.current) setIdeasLoading(false);
    }
  }

  // Pregenerate ideas in the background as soon as the page loads, so
  // opening "New Project" shows them instantly instead of waiting on a
  // Gemini call — the button still triggers a fetch itself as a fallback
  // if this hasn't resolved yet, or if the learner changes level first.
  useEffect(() => {
    void fetchIdeas(defaultLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateFromTopic(chosenTopic: string, chosenLevel: SkillLevel) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: chosenTopic, level: chosenLevel }),
      });
      if (!res.ok) throw new Error(t.projects.newProject.genericError);
      const data = await res.json();
      router.push(`/projects/${data.projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.projects.newProject.genericError);
      setGenerating(false);
    }
  }

  function handleOpen() {
    setView("ideas");
    // Already warm from the background prefetch (or a previous open at
    // this same level) — show it instantly instead of re-fetching.
    if (loadedLevel !== level) void fetchIdeas(level);
  }

  function handleLevelChange(next: SkillLevel) {
    setLevel(next);
    if (view === "ideas" && loadedLevel !== next) void fetchIdeas(next);
  }

  function handleCustomSubmit() {
    if (!topic.trim()) {
      setError(t.projects.newProject.enterTopicError);
      return;
    }
    void generateFromTopic(topic.trim(), level);
  }

  function reset() {
    setView("closed");
    setError(null);
    setTopic("");
  }

  if (view === "closed") {
    return (
      <Button onClick={handleOpen} variant="outline">
        <Sparkles className="h-4 w-4" aria-hidden />
        {t.projects.newProject.startButton}
      </Button>
    );
  }

  return (
    <Card className="border-accent/30">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {view === "ideas" ? t.projects.newProject.ideasHeading : t.projects.newProject.topicLabel}
            </p>
            {view === "ideas" && (
              <p className="mt-0.5 text-xs text-muted-foreground">{t.projects.newProject.ideasSubtitle}</p>
            )}
          </div>
          <div className="w-[160px] shrink-0 space-y-1">
            <Label className="text-xs">{t.projects.newProject.levelLabel}</Label>
            <Select
              value={level}
              onValueChange={(v) => handleLevelChange(v as SkillLevel)}
              disabled={generating || ideasLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l} className="capitalize">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {view === "ideas" ? (
          <div className="space-y-3">
            {ideasError && (
              <p className="text-sm text-destructive">{t.projects.newProject.ideasError}</p>
            )}

            {ideasLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t.projects.newProject.loadingIdeas}
              </div>
            ) : ideas.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {ideas.map((idea, i) => (
                  <Card key={i} className="flex flex-col justify-between">
                    <CardContent className="space-y-2 p-4">
                      <p className="text-sm font-medium">{idea.title}</p>
                      <p className="text-xs text-muted-foreground">{idea.description}</p>
                      <Button
                        size="sm"
                        className="mt-1 w-full"
                        disabled={generating}
                        onClick={() => generateFromTopic(idea.topic, level)}
                      >
                        {generating ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          t.projects.newProject.buildThis
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-wrap items-center gap-3">
              {!ideasLoading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchIdeas(level)}
                  disabled={generating}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  {t.projects.newProject.refreshIdeas}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setView("custom")} disabled={generating}>
                {t.projects.newProject.useOwnIdea}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset} disabled={generating}>
                {t.projects.newProject.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.projects.newProject.topicLabel}</Label>
              <Input
                placeholder={t.projects.newProject.topicPlaceholder}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleCustomSubmit} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t.projects.newProject.scopingTasks}
                  </>
                ) : (
                  t.projects.newProject.generate
                )}
              </Button>
              <Button variant="ghost" onClick={() => setView("ideas")} disabled={generating}>
                {t.projects.newProject.backToIdeas}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={generating}>
                {t.projects.newProject.cancel}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
