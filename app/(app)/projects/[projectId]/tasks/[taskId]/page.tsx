import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Review } from "@/lib/schemas";
import { ProjectTaskRunner } from "@/components/learning/project-task-runner";

export default async function ProjectTaskPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const user = await requireCurrentUser();
  const detail = await convexQuery(api.projects.getTaskDetail, { taskId: taskId as Id<"projectTasks"> });

  if (!detail || detail.task.userId !== user._id) notFound();

  const { task, submissionsWithReviews, startingFiles } = detail;

  const pastSubmissions = submissionsWithReviews.map(({ submission, review }) => ({
    id: submission._id,
    files: submission.files ?? [], // legacy submissions predate the code -> files rename
    submittedAt: submission.submittedAt,
    review: review ? ({ verdict: review.verdict, summary: review.summary, comments: review.comments } as Review) : null,
  }));

  return (
    <ProjectTaskRunner
      projectId={projectId}
      contentLocale={detail.project?.contentLocale}
      taskId={task._id}
      taskCode={task.taskCode}
      taskTitle={task.title}
      requirements={task.requirements}
      initialStatus={task.status}
      startingFiles={startingFiles}
      pastSubmissions={pastSubmissions}
    />
  );
}
