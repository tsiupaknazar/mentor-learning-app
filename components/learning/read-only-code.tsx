"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";

import type { ProgrammingLanguage } from "@/types/domain";
import { defaultFilename, languageExtension } from "@/lib/code-languages";
import { formatCode, isFormattable } from "@/lib/format-code";

/**
 * Distinct from CodeEditor: no Run/Reset controls, not wired to the
 * learner's submitted answer. Used for exercise types where the code is
 * something to *read and reason about* (predict output, explain, find the
 * bug, review, compare) rather than something to edit — the learner's
 * actual answer for those types is a separate text field.
 */
export function ReadOnlyCode({
  code,
  language = "javascript",
  filename,
}: {
  code: string;
  language?: ProgrammingLanguage;
  filename?: string;
}) {
  // Auto-format, same rationale as CodeEditor — AI-generated code can come
  // back as a single unformatted line.
  const [displayCode, setDisplayCode] = useState(code);
  useEffect(() => {
    let cancelled = false;
    setDisplayCode(code);
    if (isFormattable(language)) {
      formatCode(code, language).then((formatted) => {
        if (!cancelled) setDisplayCode(formatted);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-surface px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{filename ?? defaultFilename(language)}</span>
      </div>
      <CodeMirror
        value={displayCode}
        editable={false}
        theme={oneDark}
        extensions={[languageExtension(language)]}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
}
