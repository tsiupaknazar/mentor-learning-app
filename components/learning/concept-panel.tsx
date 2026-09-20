"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Loader2 } from "lucide-react";

import type { Concept, ConceptCheck as ConceptCheckData } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceList } from "@/components/learning/choice-list";
import { ReadOnlyCode } from "@/components/learning/read-only-code";
import { TryItExample, canTryExample } from "@/components/learning/try-it-example";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";

type ConceptExample = NonNullable<Concept["example"]>;
type ConceptSection = NonNullable<Concept["sections"]>[number];

function ConceptCard({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card className="border-accent/25 bg-accent/3">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" aria-hidden />
          <p className="font-mono text-xs uppercase tracking-widest text-accent">{label}</p>
          {aside && <p className="ml-auto text-xs text-muted-foreground">{aside}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Explanation({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-foreground/90">{children}</p>;
}

function KeyPointList({ points }: { points: string[] }) {
  return (
    <ul className="space-y-1.5">
      {points.map((point, i) => (
        <li key={i} className="flex gap-2 text-sm text-foreground/90">
          <span className="text-accent">·</span>
          {point}
        </li>
      ))}
    </ul>
  );
}

/** A code example, read-only until the learner opts to edit and run it (where the language allows). */
function Example({ example, language }: { example: ConceptExample; language: Concept["language"] }) {
  const { t } = useLocale();
  const [trying, setTrying] = useState(false);
  const tryable = canTryExample(language);
  return (
    <div className="space-y-2">
      {trying && language ? (
        <TryItExample code={example.code} language={language} />
      ) : (
        <ReadOnlyCode code={example.code} language={language ?? undefined} />
      )}
      <p className="text-xs text-muted-foreground">{example.explanation}</p>
      {tryable && !trying && (
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setTrying(true)}>
          {t.concept.tryIt}
        </Button>
      )}
    </div>
  );
}

/** One ungraded multiple-choice question; answering is instant feedback, never a gate. */
function ConceptCheck({ check, topic, heading }: { check: ConceptCheckData; topic: string; heading: string }) {
  const { t } = useLocale();
  const [picked, setPicked] = useState("");
  const answered = picked !== "";
  const correct = picked === check.choices[check.correctIndex];
  function pick(choice: string) {
    // The first answer is the signal; changing it afterwards is just exploring.
    if (!answered) track("lesson_check_answered", { topic, section: heading, correct: choice === check.choices[check.correctIndex] });
    setPicked(choice);
  }
  return (
    <div className="space-y-2 rounded-md border border-border bg-surface p-3">
      <p className="font-mono text-[11px] uppercase tracking-wide text-accent">{t.concept.quickCheck}</p>
      <p className="text-sm font-medium">{check.question}</p>
      <ChoiceList choices={check.choices} value={picked} onChange={pick} label={check.question} />
      {answered && (
        <p role="status" className={cn("text-sm", correct ? "text-mastery-strong" : "text-mastery-weak")}>
          <span className="font-medium">{correct ? t.concept.checkCorrect : t.concept.checkIncorrect}</span>{" "}
          {check.explanation}
        </p>
      )}
    </div>
  );
}

/**
 * A learner's way to say a lesson is wrong or unclear. It lands in the same
 * inbox as the general feedback button, tagged with the topic and step, so
 * lessons that keep confusing people can be found and fixed.
 */
function LessonReport({ subtopic, heading }: { subtopic: string; heading?: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send() {
    if (!text.trim() || status === "sending") return;
    setStatus("sending");
    try {
      await apiFetch("/api/feedback", {
        message: `[Lesson report] ${subtopic}${heading ? ` / ${heading}` : ""}\n\n${text.trim()}`,
        category: "bug",
        route: window.location.pathname || "/",
      });
      setStatus("sent");
      track("lesson_reported", { topic: subtopic, section: heading ?? null });
    } catch (e) {
      setError(apiErrorMessage(e, t, t.concept.reportError));
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
        {t.concept.reportSent}
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {t.concept.reportProblem}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.concept.reportPlaceholder}
        aria-label={t.concept.reportProblem}
        rows={3}
        maxLength={1500}
      />
      {status === "error" && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button size="sm" onClick={send} disabled={!text.trim() || status === "sending"}>
        {status === "sending" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {t.concept.reportSend}
      </Button>
    </div>
  );
}

function SectionBlock({
  section,
  language,
  topic,
  withCheck,
}: {
  section: ConceptSection;
  language: Concept["language"];
  topic: string;
  withCheck?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{section.heading}</h3>
      <Explanation>{section.body}</Explanation>
      {section.example && <Example example={section.example} language={language} />}
      {withCheck && section.check && <ConceptCheck check={section.check} topic={topic} heading={section.heading} />}
    </div>
  );
}

/**
 * The whole concept on one page - what "Show theory" reopens during an
 * exercise, so a learner can scan back to the bit they need. A beginner's
 * multi-section lesson is stacked in reading order; a quick concept is just
 * the explanation, key points and example. `focusHeading` scrolls to and
 * highlights one section (used to send a learner back to what they got wrong).
 */
export function ConceptPanel({ concept, focusHeading }: { concept: Concept; focusHeading?: string }) {
  const { t } = useLocale();
  const sections = concept.sections ?? [];
  const focused = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Optional-called: jsdom (tests) doesn't implement scrollIntoView.
    if (focusHeading) focused.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [focusHeading]);

  if (sections.length === 0) {
    return (
      <ConceptCard label={`${t.concept.quickConcept} · ${concept.subtopic}`}>
        <Explanation>{concept.explanation}</Explanation>
        <KeyPointList points={concept.keyPoints} />
        {concept.example && <Example example={concept.example} language={concept.language} />}
        <LessonReport subtopic={concept.subtopic} />
      </ConceptCard>
    );
  }

  return (
    <ConceptCard label={`${t.concept.lesson} · ${concept.subtopic}`}>
      <Explanation>{concept.explanation}</Explanation>
      {concept.example && <Example example={concept.example} language={concept.language} />}
      {sections.map((section, i) => {
        const isFocus = focusHeading === section.heading;
        return (
          <div
            key={i}
            ref={isFocus ? focused : undefined}
            className={cn(isFocus && "-m-2 rounded-md bg-accent/8 p-2 ring-1 ring-accent/50")}
          >
            <SectionBlock section={section} language={concept.language} topic={concept.subtopic} />
          </div>
        );
      })}
      <h3 className="text-sm font-semibold">{t.concept.keyTakeaways}</h3>
      <KeyPointList points={concept.keyPoints} />
      <LessonReport subtopic={concept.subtopic} />
    </ConceptCard>
  );
}

/**
 * The concept as it's first shown, before the exercises. A quick concept is
 * one card; a beginner's lesson is a sequence of small steps (intro, one per
 * section, recap) paged through with Back/Next, so it reads as a guided lesson
 * instead of a long scroll, with a self-check on the steps that have one. The
 * last step's button is the caller's `onFinish`.
 */
export function ConceptLesson({ concept, onFinish }: { concept: Concept; onFinish: () => void }) {
  const { t } = useLocale();
  const sections = concept.sections ?? [];
  const [step, setStep] = useState(0);
  const top = useRef<HTMLDivElement>(null);

  // Where in a lesson people stop is what shows which steps lose them.
  useEffect(() => {
    if (sections.length > 0) track("lesson_step_viewed", { topic: concept.subtopic, step: step + 1, total: sections.length + 2 });
  }, [step, sections.length, concept.subtopic]);

  const finish = () => {
    track("lesson_completed", { topic: concept.subtopic, kind: sections.length > 0 ? "lesson" : "quick" });
    onFinish();
  };
  const finishButton = (
    <Button onClick={finish} size="lg">
      {t.session.startPracticingButton}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Button>
  );

  if (sections.length === 0) {
    return (
      <div className="space-y-6">
        <ConceptPanel concept={concept} />
        {finishButton}
      </div>
    );
  }

  // Intro, one step per section, then the recap.
  const total = sections.length + 2;
  const isLast = step === total - 1;
  const currentSection = step > 0 && !isLast ? sections[step - 1]! : null;
  const go = (next: number) => {
    setStep(next);
    // Optional-called: jsdom (tests) doesn't implement scrollIntoView.
    top.current?.scrollIntoView?.({ block: "nearest" });
  };

  return (
    <div ref={top} className="space-y-6">
      <Progress value={((step + 1) / total) * 100} aria-label={t.concept.stepOf(step + 1, total)} />
      <ConceptCard label={`${t.concept.lesson} · ${concept.subtopic}`} aside={t.concept.stepOf(step + 1, total)}>
        {step === 0 && (
          <>
            <Explanation>{concept.explanation}</Explanation>
            {concept.example && <Example example={concept.example} language={concept.language} />}
          </>
        )}
        {/* Keyed per step (and distinctly from the report below) so a step's check and open examples start fresh. */}
        {currentSection && (
          <SectionBlock
            key={`section-${step}`}
            section={currentSection}
            language={concept.language}
            topic={concept.subtopic}
            withCheck
          />
        )}
        {isLast && (
          <>
            <h3 className="text-sm font-semibold">{t.concept.keyTakeaways}</h3>
            <KeyPointList points={concept.keyPoints} />
          </>
        )}
        <LessonReport key={`report-${step}`} subtopic={concept.subtopic} heading={currentSection?.heading} />
      </ConceptCard>
      <div className="flex flex-wrap gap-2">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={() => go(step - 1)}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t.concept.back}
          </Button>
        )}
        {isLast ? (
          finishButton
        ) : (
          <Button size="lg" onClick={() => go(step + 1)}>
            {t.concept.next}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
