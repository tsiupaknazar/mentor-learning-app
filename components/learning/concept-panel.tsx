"use client";

import { BookOpen } from "lucide-react";

import type { Concept } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { ReadOnlyCode } from "@/components/learning/read-only-code";
import { useLocale } from "@/lib/i18n/locale-context";

export function ConceptPanel({ concept }: { concept: Concept }) {
  const { t } = useLocale();
  return (
    <Card className="border-accent/25 bg-accent/[0.03]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" aria-hidden />
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            {t.concept.quickConcept} · {concept.subtopic}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-foreground/90">{concept.explanation}</p>

        <ul className="space-y-1.5">
          {concept.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground/90">
              <span className="text-accent">·</span>
              {point}
            </li>
          ))}
        </ul>

        {concept.example && (
          <div className="space-y-2">
            <ReadOnlyCode code={concept.example.code} />
            <p className="text-xs text-muted-foreground">{concept.example.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
