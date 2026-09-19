"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { Play, RotateCcw, Wand2 } from "lucide-react";

import type { ProgrammingLanguage } from "@/types/domain";
import { defaultFilename, languageExtension } from "@/lib/code-languages";
import { formatCode, isFormattable } from "@/lib/format-code";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";

interface CodeEditorProps {
  starterCode: string;
  /**
   * The learner's own earlier attempt, to restore when the editor remounts
   * (e.g. "Revise and resubmit" after feedback). Shown instead of
   * `starterCode`, and never auto-formatted over. "Reset" still returns to
   * the starter code, not to this.
   */
  initialCode?: string;
  onChange: (code: string) => void;
  language?: ProgrammingLanguage;
  filename?: string;
}

const RUNNABLE_LANGUAGES = new Set<ProgrammingLanguage>(["javascript", "typescript"]);

/**
 * Client-side "Run" is for the learner's own iteration — it executes in an
 * isolated Web Worker (never on the server, never eval'd on the main
 * thread) with a hard timeout, and only captures console output. It is NOT
 * the grader: submitting for AI review (app/api/evaluate) is what actually
 * scores the exercise. This mirrors how the product spec separates
 * "Run code" from "Submit answer" (section 8). Only offered for JS/TS —
 * running HTML/CSS/Python/SQL through a JS eval worker doesn't mean
 * anything; HTML/CSS get a live preview instead in MultiFileEditor.
 */
export function CodeEditor({ starterCode, initialCode, onChange, language = "javascript", filename }: CodeEditorProps) {
  const { t } = useLocale();
  const [code, setCode] = useState(initialCode ?? starterCode);
  const initialCodeRef = useRef(starterCode);
  const [output, setOutput] = useState<{ lines: string[]; error: string | null } | null>(null);
  const [running, setRunning] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const runnable = RUNNABLE_LANGUAGES.has(language);
  const formattable = isFormattable(language);

  // Auto-format once on mount — covers AI-generated starter code that came
  // back as a single unformatted line (see lib/format-code.ts). Only the
  // initial content, never re-runs while the learner is actively typing.
  // "Reset" below restores this formatted version, not the raw original,
  // so resetting doesn't re-introduce the unformatted starting point.
  // When restoring an earlier attempt (`initialCode`), the formatted starter
  // is still computed for Reset, but never replaces what the learner wrote.
  useEffect(() => {
    let cancelled = false;
    if (formattable) {
      formatCode(starterCode, language).then((formatted) => {
        if (cancelled || formatted === starterCode) return;
        initialCodeRef.current = formatted;
        if (initialCode !== undefined) return;
        setCode(formatted);
        onChange(formatted);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setCode(value);
      onChange(value);
    },
    [onChange]
  );

  async function handleFormat() {
    setFormatting(true);
    try {
      const formatted = await formatCode(code, language);
      setCode(formatted);
      onChange(formatted);
    } finally {
      setFormatting(false);
    }
  }

  function reset() {
    setCode(initialCodeRef.current);
    onChange(initialCodeRef.current);
    setOutput(null);
  }

  function run() {
    workerRef.current?.terminate();
    setRunning(true);
    setOutput(null);

    const workerSource = `
      const logs = [];
      const push = (...args) => logs.push(args.map(a => {
        try { return typeof a === "string" ? a : JSON.stringify(a); }
        catch { return String(a); }
      }).join(" "));
      const console = { log: push, info: push, warn: push, error: push };
      self.onmessage = (e) => {
        try {
          const fn = new Function("console", e.data);
          fn(console);
          self.postMessage({ lines: logs, error: null });
        } catch (err) {
          self.postMessage({ lines: logs, error: err instanceof Error ? err.message : String(err) });
        }
      };
    `;
    const blob = new Blob([workerSource], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    const timeout = setTimeout(() => {
      worker.terminate();
      setOutput({ lines: [], error: t.codeEditor.timedOut });
      setRunning(false);
    }, 3000);

    worker.onmessage = (e: MessageEvent<{ lines: string[]; error: string | null }>) => {
      clearTimeout(timeout);
      setOutput(e.data);
      setRunning(false);
      worker.terminate();
    };
    worker.onerror = (e) => {
      clearTimeout(timeout);
      setOutput({ lines: [], error: e.message });
      setRunning(false);
      worker.terminate();
    };
    worker.postMessage(code);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{filename ?? defaultFilename(language)}</span>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={reset} className="h-7 px-2 text-xs">
            <RotateCcw className="h-3 w-3" aria-hidden />
            {t.codeEditor.reset}
          </Button>
          {formattable && (
            <Button variant="ghost" size="sm" onClick={handleFormat} disabled={formatting} className="h-7 px-2 text-xs">
              <Wand2 className="h-3 w-3" aria-hidden />
              {formatting ? t.codeEditor.formatting : t.codeEditor.format}
            </Button>
          )}
          {runnable && (
            <Button variant="secondary" size="sm" onClick={run} disabled={running} className="h-7 px-2 text-xs">
              <Play className="h-3 w-3" aria-hidden />
              {running ? t.codeEditor.running : t.codeEditor.run}
            </Button>
          )}
        </div>
      </div>
      <CodeMirror
        value={code}
        height="240px"
        theme={oneDark}
        extensions={[languageExtension(language)]}
        onChange={handleChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      />
      {output && (
        <div
          className={cn(
            "border-t border-border bg-background p-3 font-mono text-xs",
            output.error ? "text-destructive" : "text-foreground/90"
          )}
        >
          {output.lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          {output.error && <div>{t.codeEditor.error}: {output.error}</div>}
          {!output.error && output.lines.length === 0 && (
            <div className="text-muted-foreground">{t.codeEditor.noConsoleOutput}</div>
          )}
        </div>
      )}
    </div>
  );
}
