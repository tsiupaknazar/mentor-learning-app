import Link from "next/link";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMastery, masteryBand } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n/dictionaries";

const AXIS_KEYS = ["knowledge", "application", "debugging", "explanation", "retention"] as const;

export default async function KnowledgeMapPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");
  const data = await convexQuery(api.learningPaths.getActiveLearningPath, { userId: user._id });

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {t.knowledgeMap.noActivePath}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t.knowledgeMap.eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{data.path.title}</h1>
      </div>

      <div className="space-y-3">
        {data.topics.map((tp: {
          _id: string;
          title: string;
          progress: { mastery: Record<string, number> } | null;
        }) => {
          const mastery = tp.progress?.mastery;
          const band = masteryBand(mastery?.overall ?? 0);
          return (
            <Card key={tp._id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <Link href={`/learn/${tp._id}`} className="text-sm font-medium hover:text-accent">
                    {tp.title}
                  </Link>
                  <span
                    className={
                      band === "strong"
                        ? "font-mono text-sm text-mastery-strong"
                        : band === "medium"
                          ? "font-mono text-sm text-mastery-medium"
                          : "font-mono text-sm text-mastery-weak"
                    }
                  >
                    {formatMastery(mastery?.overall ?? 0)}
                  </span>
                </div>
                {mastery ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AXIS_KEYS.map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-muted-foreground">{t.knowledgeMap.axes[key]}</span>
                        <Progress value={mastery[key]} className="h-1 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t.knowledgeMap.notAttempted}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
