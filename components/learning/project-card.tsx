"use client";

import Link from "next/link";

import type { TranslatedProject } from "@/lib/schemas";
import type { Locale } from "@/types/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/i18n/locale-context";
import { levelLabel } from "@/lib/i18n/dictionaries";
import { useContentTranslation } from "@/lib/i18n/use-content-translation";

const STATUS_VARIANT = {
  not_started: "outline",
  in_progress: "medium",
  completed: "strong",
} as const;

export function ProjectCard({
  project,
  taskCount,
  doneCount,
}: {
  project: {
    _id: string;
    title: string;
    description: string;
    level: string;
    status: "not_started" | "in_progress" | "completed";
    contentLocale?: Locale;
  };
  taskCount: number;
  doneCount: number;
}) {
  const { t } = useLocale();
  const translated = useContentTranslation<TranslatedProject>(
    "/api/translate/project",
    "projectId",
    project._id,
    project.contentLocale
  );

  const title = translated?.title ?? project.title;
  const description = translated?.description ?? project.description;

  return (
    <Link href={`/projects/${project._id}`}>
      <Card className="transition-colors hover:border-accent/50">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{title}</p>
              <Badge variant="outline">{levelLabel(t, project.level)}</Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono-tabular text-xs text-muted-foreground">
              {t.projects.tasksCount(doneCount, taskCount)}
            </span>
            <Badge variant={STATUS_VARIANT[project.status]}>{t.projects.statusLabels[project.status]}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
