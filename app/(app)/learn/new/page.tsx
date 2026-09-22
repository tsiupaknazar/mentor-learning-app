import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { NewPathFlow } from "@/components/learning/new-path-flow";
import { suggestNextTopics } from "@/lib/topic-progression";
import type { LearningGoal, LearningStyle, DailyTime, Specialty } from "@/types/domain";

export default async function NewLearningPathPage() {
  const user = await requireCurrentUser();
  const paths = await convexQuery(api.learningPaths.listLearningPaths, { userId: user._id });

  const triedTopics = paths.map((p: { topic: string }) => p.topic);
  const mostRecentTopic = paths[0]?.topic as string | undefined;
  const suggested = suggestNextTopics(mostRecentTopic).filter(
    (s) => !triedTopics.some((tried) => tried.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-2xl">
      <NewPathFlow
        userId={user._id}
        currentGoal={user.learningGoal as LearningGoal}
        currentStyle={user.learningStyle as LearningStyle}
        currentTime={user.dailyTime as DailyTime}
        specialty={(user.specialty as Specialty | undefined) ?? "general"}
        suggestedTopics={suggested}
        triedTopics={triedTopics}
      />
    </div>
  );
}
