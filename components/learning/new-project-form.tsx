"use client";

import { useRef, useState } from "react";
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
import { levelLabel } from "@/lib/i18n/dictionaries";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { loadDraft, saveDraft } from "@/lib/drafts";
import { LoadingSteps } from "@/components/learning/loading-steps";

const LEVELS: SkillLevel[] = ["beginner", "junior", "intermediate", "advanced"];

// Generated ideas are kept briefly so reopening the form (or reloading the
// page) doesn't pay for another AI call.
const IDEAS_TTL_MS = 30 * 60 * 1000;

// "closed": just the start button. "ideas": browsing prepared suggestions
// (the default once opened). "custom": the original free-text topic form,
// reached either deliberately or as a fallback if idea generation fails.
type ViewState = "closed" | "ideas" | "custom";

export function NewProjectForm({ defaultLevel }: { defaultLevel: SkillLevel }) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [view, setView] = useState<ViewState>("closed");
  const [level, setLevel] = useState<SkillLevel>(defaultLevel);

  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [loadedLevel, setLoadedLevel] = useState<SkillLevel | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState(false);
  // Bumped on every network fetch so a slower, older request can't clobber a
  // newer one's result if they land out of order.
  const requestIdRef = useRef(0);
  // The level a request is currently in flight for, so hovering the button
  // and then clicking it share one request instead of paying for two.
  const inflightLevelRef = useRef<SkillLevel | null>(null);

  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ideasKey = (forLevel: SkillLevel) => `project-ideas:${locale}:${forLevel}`;

  // `force` (the "refresh ideas" button) skips both the cache and the
  // in-flight check - the learner explicitly wants a new batch.
  async function fetchIdeas(forLevel: SkillLevel, { force = false } = {}) {
    if (!force) {
      const cached = loadDraft<ProjectIdea[]>(ideasKey(forLevel), IDEAS_TTL_MS);
      if (cached && cached.length > 0) {
        setIdeas(cached);
        setLoadedLevel(forLevel);
        setIdeasError(false);
        return;
      }
      if (inflightLevelRef.current === forLevel) return; // already on its way
    }
    const requestId = ++requestIdRef.current;
    inflightLevelRef.current = forLevel;
    setIdeasLoading(true);
    setIdeasError(false);
    try {
      const data = await apiFetch<{ ideas: ProjectIdea[] }>("/api/project/ideas", { level: forLevel });
      if (requestId !== requestIdRef.current) return; // superseded by a newer fetch
      setIdeas(data.ideas);
      setLoadedLevel(forLevel);
      saveDraft(ideasKey(forLevel), data.ideas);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setIdeas([]);
      setIdeasError(true);
    } finally {
      if (requestId === requestIdRef.current) {
        setIdeasLoading(false);
        inflightLevelRef.current = null;
      }
    }
  }

  // Ideas used to be requested on every page load, even for learners who
  // never opened the form. Now they're requested on *intent* - hovering,
  // focusing or touching the start button - which is early enough that they
  // are usually there by the click, without paying for a call per page view.
  function warmUpIdeas() {
    if (view === "closed" && loadedLevel !== level) void fetchIdeas(level);
  }

  async function generateFromTopic(chosenTopic: string, chosenLevel: SkillLevel) {
    setGenerating(true);
    setError(null);
    try {
      const data = await apiFetch<{ projectId: string }>("/api/project", { topic: chosenTopic, level: chosenLevel });
      router.push(`/projects/${data.projectId}`);
    } catch (e) {
      setError(apiErrorMessage(e, t, t.projects.newProject.genericError));
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
      <Button
        onClick={handleOpen}
        onPointerEnter={warmUpIdeas}
        onFocus={warmUpIdeas}
        onTouchStart={warmUpIdeas}
        variant="outline"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {t.projects.newProject.startButton}
      </Button>
    );
  }

  // Scoping a project takes a while: show progress instead of dimmed controls.
  // A failure drops back to the form below, with the error and the input intact.
  if (generating) {
    return (
      <Card className="border-accent/30">
        <CardContent className="p-5">
          <LoadingSteps
            messages={[t.projects.newProject.scopingTasks, ...t.projects.newProject.buildingSteps]}
            intervalMs={3500}
          />
        </CardContent>
      </Card>
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
              disabled={ideasLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {levelLabel(t, l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {view === "ideas" ? (
          <div className="space-y-3">
            {ideasError && (
              <p role="alert" className="text-sm text-destructive">{t.projects.newProject.ideasError}</p>
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
                      <Button size="sm" className="mt-1 w-full" onClick={() => generateFromTopic(idea.topic, level)}>
                        {t.projects.newProject.buildThis}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-wrap items-center gap-3">
              {!ideasLoading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchIdeas(level, { force: true })}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  {t.projects.newProject.refreshIdeas}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setView("custom")}>
                {t.projects.newProject.useOwnIdea}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
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
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleCustomSubmit}>{t.projects.newProject.generate}</Button>
              <Button variant="ghost" onClick={() => setView("ideas")}>
                {t.projects.newProject.backToIdeas}
              </Button>
              <Button variant="ghost" onClick={reset}>
                {t.projects.newProject.cancel}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
