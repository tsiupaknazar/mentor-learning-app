import { requireCurrentUser } from "@/lib/current-user";
import { PracticeBoard } from "@/components/learning/practice-board";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function PracticePage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t.practice.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t.practice.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t.practice.subtitle}
        </p>
      </div>

      <PracticeBoard userId={user._id} />
    </div>
  );
}
