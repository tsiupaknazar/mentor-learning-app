import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ProjectDetailView } from "@/components/learning/project-detail-view";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireCurrentUser();
  const detail = await convexQuery(api.projects.getProjectDetail, {
    projectId: projectId as Id<"projects">,
  });

  if (!detail || detail.project.userId !== user._id) notFound();

  const { project, tasks } = detail;

  return <ProjectDetailView project={project} tasks={tasks} />;
}
