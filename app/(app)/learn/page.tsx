import Link from "next/link";

import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { LearnPathView, type LearnTopicRow } from "@/components/learning/learn-path-view";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function LearnPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");
  const [data, summary] = await Promise.all([
    convexQuery(api.learningPaths.getActiveLearningPath, { userId: user._id }),
    convexQuery(api.dashboard.getDashboardSummary, { userId: user._id }),
  ]);

  if (!data) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {t.learn.noActivePath}{" "}
          <Link href="/learn/new" className="text-accent underline underline-offset-4">
            {t.learn.startNewTopic}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <LearnPathView
      learningPathId={data.path._id}
      contentLocale={data.path.contentLocale}
      path={{ title: data.path.title, rationale: data.path.rationale }}
      topics={data.topics as unknown as LearnTopicRow[]}
      // Same pick as the dashboard's hero card, so both agree on "what's next".
      nextTopicId={summary?.nextAction?.topicId ?? null}
    />
  );
}
