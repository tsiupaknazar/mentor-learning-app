import { requireCurrentUser } from "@/lib/current-user";
import { convexQuery } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MistakeList } from "@/components/learning/mistake-list";

export default async function MistakesPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");
  const pathData = await convexQuery(api.learningPaths.getActiveLearningPath, { userId: user._id });

  const titleByTopicId: Record<string, string> = Object.fromEntries(
    (pathData?.topics ?? []).map((tp: { _id: string; title: string }) => [tp._id, tp.title])
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t.mistakes.eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{t.mistakes.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.mistakes.subtitle}</p>
      </div>

      <MistakeList userId={user._id} titleByTopicId={titleByTopicId} />
    </div>
  );
}

