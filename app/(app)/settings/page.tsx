import { requireCurrentUser } from "@/lib/current-user";
import { SettingsForm } from "@/components/learning/settings-form";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t.settings.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t.settings.title}</h1>
      </div>
      <SettingsForm
        userId={user._id}
        email={user.email}
        level={user.level}
        learningGoal={user.learningGoal}
        learningStyle={user.learningStyle}
        dailyTime={user.dailyTime}
        specialty={user.specialty ?? "general"}
      />
    </div>
  );
}
