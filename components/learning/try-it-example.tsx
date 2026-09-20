"use client";

import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";

import type { ProgrammingLanguage } from "@/types/domain";
import { languageExtension } from "@/lib/code-languages";
import { CodeEditor } from "@/components/learning/code-editor";
import { LivePreview } from "@/components/learning/live-preview";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * Lesson examples a learner can edit and run: JavaScript/TypeScript run in
 * the exercise editor's sandboxed worker, HTML renders in a sandboxed
 * iframe. Other languages (CSS on its own has nothing to render against;
 * Python/SQL have no in-browser runner here) stay read-only.
 */
export function canTryExample(language: ProgrammingLanguage | null | undefined): boolean {
  return language === "javascript" || language === "typescript" || language === "html";
}

export function TryItExample({ code, language }: { code: string; language: ProgrammingLanguage }) {
  if (language === "html") return <HtmlPlayground code={code} />;
  // Nothing here reads the edits back: it's a scratchpad, never an answer.
  return <CodeEditor starterCode={code} language={language} onChange={() => {}} compact />;
}

function HtmlPlayground({ code }: { code: string }) {
  const { t } = useLocale();
  const [html, setHtml] = useState(code);
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border border-border">
        <CodeMirror
          value={html}
          minHeight="96px"
          maxHeight="260px"
          theme={oneDark}
          extensions={[languageExtension("html")]}
          onChange={setHtml}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
        />
      </div>
      <LivePreview srcDoc={html} title={t.concept.tryItPreview} />
    </div>
  );
}
