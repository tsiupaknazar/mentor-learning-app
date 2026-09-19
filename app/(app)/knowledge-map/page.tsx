import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { KnowledgeMapView, type KnowledgeTopic } from "@/components/learning/knowledge-map-view";
import { getDictionary } from "@/lib/i18n/dictionaries";

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

  // Decided once, on the server, so "review due" can't flicker between renders.
  // eslint-disable-next-line react-hooks/purity -- async server component: runs once per request, never re-renders
  const nowMs = Date.now();

  return (
    <KnowledgeMapView
      learningPathId={data.path._id}
      contentLocale={data.path.contentLocale}
      pathTitle={data.path.title}
      topics={data.topics as unknown as KnowledgeTopic[]}
      nowMs={nowMs}
    />
  );
}
