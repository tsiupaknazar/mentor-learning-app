"use client";

import { useCallback, useState } from "react";
import { Check, FlaskConical, X } from "lucide-react";

import type { ProgrammingLanguage } from "@/types/domain";
import { CodeEditor } from "@/components/learning/code-editor";
import { LivePreview } from "@/components/learning/live-preview";
import { Button } from "@/components/ui/button";
import { buildPreviewDoc } from "@/lib/preview-doc";
import { isRunnableTestSuite, runJsTests, type JsTestCase, type TestResult } from "@/lib/js-tests";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";
import { useLocale } from "@/lib/i18n/locale-context";

interface ExerciseEditorProps {
  starterCode: string;
  /** The learner's earlier attempt to restore, when returning via "Revise and resubmit". */
  initialCode?: string;
  language: ProgrammingLanguage;
  /** For CSS exercises: the markup their styles are applied to in the preview. */
  previewMarkup?: string | null;
  /** JavaScript exercises: run against these when they follow the runnable format (lib/js-tests.ts). */
  testCases?: JsTestCase[] | null;
  onChange: (code: string) => void;
}

/**
 * The editor for an exercise whose answer is code, with what the code does
 * shown beside it: a live preview for HTML and (given markup) CSS, so a
 * learner writing markup can see the page they're making rather than
 * guessing. The code editor's own Run covers JavaScript.
 */
export function ExerciseEditor({ starterCode, initialCode, language, previewMarkup, testCases, onChange }: ExerciseEditorProps) {
  const { t } = useLocale();
  const [code, setCode] = useState(initialCode ?? starterCode);
  const [results, setResults] = useState<TestResult[] | "unavailable" | null>(null);
  const [running, setRunning] = useState(false);
  const runnableTests = language === "javascript" && isRunnableTestSuite(testCases) ? testCases : null;
  const handleChange = useCallback(
    (next: string) => {
      setCode(next);
      setResults(null); // results describe the code that was run, not what's in the editor now
      onChange(next);
    },
    [onChange]
  );

  async function runTests() {
    if (!runnableTests) return;
    setRunning(true);
    try {
      const ran = await runJsTests(code, runnableTests);
      setResults(ran ?? "unavailable");
      if (ran) track("tests_run", { passed: ran.filter((r) => r.passed).length, total: ran.length });
    } finally {
      setRunning(false);
    }
  }
  const previewDoc = buildPreviewDoc(language, code, previewMarkup);

  return (
    <div className="space-y-3">
      <CodeEditor
        starterCode={starterCode}
        initialCode={initialCode}
        onChange={handleChange}
        language={language}
      />
      {runnableTests && (
        <div className="space-y-2">
          <Button variant="secondary" size="sm" onClick={runTests} disabled={running}>
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            {running ? t.codeEditor.runningTests : t.codeEditor.runTests}
          </Button>
          {results === "unavailable" && <p className="text-xs text-muted-foreground">{t.codeEditor.testsUnavailable}</p>}
          {Array.isArray(results) && <TestResults results={results} />}
        </div>
      )}
      {previewDoc !== null && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t.codeEditor.preview}</p>
          <LivePreview srcDoc={previewDoc} title={t.codeEditor.preview} className="h-56" />
        </div>
      )}
    </div>
  );
}

function TestResults({ results }: { results: TestResult[] }) {
  const { t } = useLocale();
  const passed = results.filter((r) => r.passed).length;
  return (
    <div className="space-y-1.5 rounded-md border border-border bg-surface p-3">
      <p role="status" className="text-xs font-medium">
        {t.codeEditor.testsSummary(passed, results.length)}
      </p>
      <ul className="space-y-1">
        {results.map((r, i) => (
          <li key={i} className="flex gap-2 font-mono text-xs">
            {r.passed ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mastery-strong" aria-label="pass" />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mastery-weak" aria-label="fail" />
            )}
            <span className={cn(!r.passed && "text-foreground/90")}>
              {r.input}
              {!r.passed && (
                <span className="block text-muted-foreground">
                  {t.codeEditor.testExpected(r.expected)}
                  {r.error ? ` \u00b7 ${r.error}` : ` \u00b7 ${t.codeEditor.testGot(r.actual ?? "")}`}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
