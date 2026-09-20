"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";

import type { ProgrammingLanguage } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReadOnlyCode } from "@/components/learning/read-only-code";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * The worked solution once it has been fetched. `asCode` is for exercises
 * whose answer is code; for the rest the "solution" is a description of the
 * ideal answer, which reads as text.
 */
export function SolutionPanel({
  solution,
  asCode,
  language,
}: {
  solution: string;
  asCode: boolean;
  language: ProgrammingLanguage;
}) {
  const { t } = useLocale();
  return (
    <Card className="border-accent/25 bg-accent/3">
      <CardContent className="space-y-3 p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{t.session.solutionTitle}</p>
        {asCode ? (
          <ReadOnlyCode code={solution} language={language} />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{solution}</p>
        )}
        <p className="text-xs text-muted-foreground">{t.session.solutionNote}</p>
      </CardContent>
    </Card>
  );
}

/**
 * "Show the solution", offered after an answer that wasn't right. The server
 * only hands it over once there has been such an attempt (app/api/solution),
 * so this is the way out for someone stuck, not a way around trying.
 */
export function SolutionReveal({ exerciseId, onLoaded }: { exerciseId: string; onLoaded: (solution: string) => void }) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ solution: string }>("/api/solution", { exerciseId });
      onLoaded(data.solution);
    } catch (e) {
      setError(apiErrorMessage(e, t, t.session.couldNotLoadSolution));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={reveal} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        {t.session.showSolution}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
