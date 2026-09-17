import { MessagesSquare } from "lucide-react";

import { requireCurrentUser } from "@/lib/current-user";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function InterviewPage() {
  const user = await requireCurrentUser();
  const t = getDictionary(user.locale ?? "en");

  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <MessagesSquare className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">{t.interview.title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t.interview.body1}{" "}
        <code className="font-mono text-xs">lib/prompts.ts</code> and{" "}
        <code className="font-mono text-xs">lib/gemini.ts</code>.
      </p>
    </div>
  );
}
