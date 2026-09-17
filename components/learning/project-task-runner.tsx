"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";
import type { Review, TranslatedProject } from "@/lib/schemas";
import type { Locale } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MultiFileEditor, type EditableFile } from "@/components/learning/multi-file-editor";
import { ReviewPanel } from "@/components/learning/review-panel";
import { useLocale } from "@/lib/i18n/locale-context";
import { useContentTranslation } from "@/lib/i18n/use-content-translation";
import { track } from "@/lib/analytics/track";

interface PastSubmission {
  id: string;
  files: Array<{ filename: string; content: string }>;
  submittedAt: number;
  review: Review | null;
}

interface ProjectTaskRunnerProps {
  projectId: string;
  contentLocale?: Locale;
  taskId: Id<"projectTasks">;
  taskCode: string;
  taskTitle: string;
  requirements: string[];
  initialStatus: "todo" | "in_review" | "changes_requested" | "done";
  startingFiles: EditableFile[];
  pastSubmissions: PastSubmission[];
}

export function ProjectTaskRunner({
  projectId,
  contentLocale,
  taskId,
  taskCode,
  taskTitle,
  requirements,
  initialStatus,
  startingFiles,
  pastSubmissions,
}: ProjectTaskRunnerProps) {
  const { t } = useLocale();
  const latest = pastSubmissions[0] ?? null;

  // The full project bundle (not just this task) is what's cached — the
  // learner will hit other tasks in the same project too, and this way
  // navigating between tickets in one project only ever costs one Gemini
  // call, not one per ticket.
  const translated = useContentTranslation<TranslatedProject>(
    "/api/translate/project",
    "projectId",
    projectId,
    contentLocale
  );
  const translatedTask = translated?.tasks.find((tk) => tk.taskCode === taskCode) ?? null;
  const title = translatedTask?.title ?? taskTitle;
  const displayedRequirements = translatedTask?.requirements ?? requirements;

  const [files, setFiles] = useState<Array<{ filename: string; content: string }>>(
    startingFiles.map((f) => ({ filename: f.filename, content: f.content }))
  );
  const [status, setStatus] = useState(initialStatus);
  const [review, setReview] = useState<Review | null>(latest?.review ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (files.every((f) => !f.content.trim())) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/project/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectTaskId: taskId, files }),
      });
      if (!res.ok) throw new Error(t.taskRunner.couldNotReview);
      const data = await res.json();
      const nextStatus = data.taskStatus as typeof status;
      setReview(data.review as Review);
      setStatus(nextStatus);

      track("project_task_reviewed", {
        projectId,
        taskCode,
        verdict: (data.review as Review).verdict,
        status: nextStatus,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.taskRunner.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t.taskRunner.backToProject}
      </Link>

      {/* Ticket header — matches the spec's TASK-ticket format */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-mono text-xs text-accent">TASK {taskCode}</p>
          <h1 className="text-xl font-semibold">{title}</h1>
          <div>
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {t.taskRunner.requirements}
            </p>
            <ul className="space-y-1">
              {displayedRequirements.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="text-muted-foreground">-</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {status === "done" && !submitting ? (
        <div className="flex items-center gap-2 rounded-md border border-mastery-strong/30 bg-mastery-strong/[0.06] px-4 py-3 text-sm text-mastery-strong">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {t.taskRunner.approved}
        </div>
      ) : null}

      <MultiFileEditor files={startingFiles} onChange={setFiles} />

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={submitting || files.every((f) => !f.content.trim())}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t.taskRunner.reviewing}
            </>
          ) : status === "changes_requested" ? (
            <>
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t.taskRunner.resubmit}
            </>
          ) : (
            t.taskRunner.submitForReview
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {review && <ReviewPanel review={review} />}

      {pastSubmissions.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t.taskRunner.earlierSubmissions(pastSubmissions.length - 1)}
          </summary>
          <div className="mt-3 space-y-3">
            {pastSubmissions.slice(1).map((s) => (
              <div key={s.id} className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">
                  {new Date(s.submittedAt).toLocaleString()}
                </p>
                {s.review && <ReviewPanel review={s.review} />}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
