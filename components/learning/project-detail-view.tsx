"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, AlertCircle, Clock } from "lucide-react";

import type { TranslatedProject } from "@/lib/schemas";
import type { Locale } from "@/types/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/i18n/locale-context";
import { useContentTranslation } from "@/lib/i18n/use-content-translation";

const TASK_STATUS_ICON = {
  todo: { icon: Circle, className: "text-muted-foreground" },
  in_review: { icon: Clock, className: "text-mastery-medium" },
  changes_requested: { icon: AlertCircle, className: "text-mastery-weak" },
  done: { icon: CheckCircle2, className: "text-mastery-strong" },
} as const;

type TaskRow = {
  _id: string;
  taskCode: string;
  title: string;
  status: keyof typeof TASK_STATUS_ICON;
};

export function ProjectDetailView({
  project,
  tasks,
}: {
  project: {
    _id: string;
    topic: string;
    title: string;
    description: string;
    level: string;
    contentLocale?: Locale;
  };
  tasks: TaskRow[];
}) {
  const { t } = useLocale();
  const translated = useContentTranslation<TranslatedProject>(
    "/api/translate/project",
    "projectId",
    project._id,
    project.contentLocale
  );

  const translatedTaskByCode = new Map((translated?.tasks ?? []).map((tk) => [tk.taskCode, tk]));
  const title = translated?.title ?? project.title;
  const description = translated?.description ?? project.description;

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t.projects.backToProjects}
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {t.projects.eyebrow} · {project.topic}
          </p>
          <Badge variant="outline" className="capitalize">
            {project.level}
          </Badge>
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const meta = TASK_STATUS_ICON[task.status];
          const Icon = meta.icon;
          const taskTitle = translatedTaskByCode.get(task.taskCode)?.title ?? task.title;
          return (
            <Link key={task._id} href={`/projects/${project._id}/tasks/${task._id}`}>
              <Card className="transition-colors hover:border-accent/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{task.taskCode}</p>
                    <p className="truncate text-sm font-medium">{taskTitle}</p>
                  </div>
                  <span className={`shrink-0 font-mono text-xs ${meta.className}`}>
                    {t.projects.taskStatus[task.status]}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
