"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

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
import { useDraft } from "@/lib/drafts";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";

type DraftFiles = Array<{ filename: string; content: string }>;

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
  /** The next open task in this project, if any - offered once this one is approved. */
  nextTask?: { _id: string; taskCode: string; title: string } | null;
  pastSubmissions: PastSubmission[];
}

export function ProjectTaskRunner(props: ProjectTaskRunnerProps) {
  const { ready, draft, save, clear } = useDraft<DraftFiles>(`project-task:${props.taskId}`);

  // The editor seeds its files once, on mount - wait for the stored draft so
  // an unsubmitted attempt isn't replaced by the starting files on refresh.
  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;

  // Only files that still exist in this task's starting set are restored.
  const restored = props.startingFiles.map((f) => ({
    ...f,
    content: draft?.find((d) => d.filename === f.filename)?.content ?? f.content,
  }));

  return <ProjectTaskRunnerBody {...props} startingFiles={restored} originalFiles={props.startingFiles} save={save} clear={clear} />;
}

function ProjectTaskRunnerBody({
  projectId,
  contentLocale,
  taskId,
  taskCode,
  taskTitle,
  requirements,
  initialStatus,
  startingFiles,
  originalFiles,
  nextTask,
  pastSubmissions,
  save,
  clear,
}: ProjectTaskRunnerProps & {
  originalFiles: EditableFile[];
  save: (files: DraftFiles) => void;
  clear: () => void;
}) {
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

  // The review lands below the editor - often off-screen on a long file - so
  // after a fresh submission (not on first load) bring it into view.
  const reviewRef = useRef<HTMLDivElement>(null);
  const scrollToReviewRef = useRef(false);
  useEffect(() => {
    if (scrollToReviewRef.current && review) {
      scrollToReviewRef.current = false;
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [review]);

  // Persist only real edits - untouched starting files aren't worth a draft.
  useEffect(() => {
    const dirty = files.some((f) => f.content !== originalFiles.find((o) => o.filename === f.filename)?.content);
    if (dirty) save(files);
  }, [files, originalFiles, save]);

  async function handleSubmit() {
    if (files.every((f) => !f.content.trim())) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{ review: Review; taskStatus: typeof status }>("/api/project/review", {
        projectTaskId: taskId,
        files,
      });
      const nextStatus = data.taskStatus;
      scrollToReviewRef.current = true;
      setReview(data.review);
      setStatus(nextStatus);
      // The submission is now the saved state (it becomes the next starting
      // point), so the local draft would only be stale.
      clear();

      track("project_task_reviewed", {
        projectId,
        taskCode,
        verdict: data.review.verdict,
        status: nextStatus,
      });
    } catch (e) {
      setError(apiErrorMessage(e, t, t.taskRunner.couldNotReview));
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
        <div className="flex items-center gap-2 rounded-md border border-mastery-strong/30 bg-mastery-strong/6 px-4 py-3 text-sm text-mastery-strong">
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
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {review && (
        <div ref={reviewRef} className="scroll-mt-6 space-y-4">
          <ReviewPanel review={review} />
          {status === "done" && !submitting && (
            <Button asChild>
              <Link href={nextTask ? `/projects/${projectId}/tasks/${nextTask._id}` : `/projects/${projectId}`}>
                {nextTask ? t.taskRunner.nextTask(nextTask.taskCode, nextTask.title) : t.taskRunner.backToProject}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      )}

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
