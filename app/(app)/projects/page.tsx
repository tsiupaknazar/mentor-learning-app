import { FolderKanban } from "lucide-react";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { NewProjectForm } from "@/components/learning/new-project-form";
import { ProjectCard } from "@/components/learning/project-card";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function ProjectsPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");
  const projects = await convexQuery(api.projects.listProjects, { userId: user._id });

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t.projects.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t.projects.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.projects.subtitle}</p>
      </div>

      <NewProjectForm defaultLevel={user.level} />

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <FolderKanban className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t.projects.noProjects}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map(({ project, taskCount, doneCount }) => (
            <ProjectCard key={project._id} project={project} taskCount={taskCount} doneCount={doneCount} />
          ))}
        </div>
      )}
    </div>
  );
}
