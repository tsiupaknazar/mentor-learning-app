"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import type { ProgrammingLanguage } from "@/types/domain";
import { CodeEditor } from "@/components/learning/code-editor";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";

export interface EditableFile {
  filename: string;
  language: ProgrammingLanguage;
  content: string;
}

interface MultiFileEditorProps {
  files: EditableFile[];
  onChange: (files: Array<{ filename: string; content: string }>) => void;
}

/**
 * Fixes the gap where a project needing more than one language (e.g. a
 * "JS Kanban board" with index.html + styles.css + script.js) only had a
 * single JS-only editor box to work in. Each file gets its own tab with
 * correct syntax highlighting; an HTML file also unlocks a "Preview" tab
 * that renders the combined HTML/CSS/JS in a sandboxed iframe so the
 * learner can actually see what they built before submitting for review.
 */
export function MultiFileEditor({ files, onChange }: MultiFileEditorProps) {
  const { t } = useLocale();
  const [contents, setContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(files.map((f) => [f.filename, f.content]))
  );
  const [activeTab, setActiveTab] = useState<string>(files[0]?.filename ?? "");

  const hasHtml = files.some((f) => f.language === "html");

  function updateFile(filename: string, content: string) {
    const next = { ...contents, [filename]: content };
    setContents(next);
    onChange(files.map((f) => ({ filename: f.filename, content: next[f.filename] ?? "" })));
  }

  const previewSrcDoc = useMemo(() => {
    if (!hasHtml) return null;
    const htmlFile = files.find((f) => f.language === "html");
    const cssContent = files.filter((f) => f.language === "css").map((f) => contents[f.filename] ?? "").join("\n");
    const jsContent = files
      .filter((f) => f.language === "javascript" || f.language === "typescript")
      .map((f) => contents[f.filename] ?? "")
      .join("\n");
    const baseHtml = htmlFile ? contents[htmlFile.filename] ?? "" : "<body></body>";
    // Inject actual CSS/JS content directly rather than relying on the
    // markup's <link>/<script src> tags — those point at files that don't
    // exist inside a sandboxed srcdoc iframe, so this always works
    // regardless of what the generated HTML happens to reference.
    return baseHtml.includes("</body>")
      ? baseHtml.replace("</body>", `<style>${cssContent}</style><script>${jsContent}</script></body>`)
      : `${baseHtml}<style>${cssContent}</style><script>${jsContent}</script>`;
  }, [contents, files, hasHtml]);

  const activeFile = files.find((f) => f.filename === activeTab);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {files.map((f) => (
          <button
            key={f.filename}
            type="button"
            onClick={() => setActiveTab(f.filename)}
            className={cn(
              "rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
              activeTab === f.filename
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {f.filename}
          </button>
        ))}
        {hasHtml && (
          <button
            type="button"
            onClick={() => setActiveTab("__preview__")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
              activeTab === "__preview__"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Eye className="h-3 w-3" aria-hidden />
            {t.multiFileEditor.preview}
          </button>
        )}
      </div>

      {activeTab === "__preview__" && previewSrcDoc !== null ? (
        <div className="overflow-hidden rounded-md border border-border bg-white">
          <iframe
            title="Live preview"
            srcDoc={previewSrcDoc}
            sandbox="allow-scripts"
            className="h-[400px] w-full"
          />
        </div>
      ) : activeFile ? (
        <CodeEditor
          key={activeFile.filename}
          starterCode={contents[activeFile.filename] ?? activeFile.content}
          language={activeFile.language}
          filename={activeFile.filename}
          onChange={(value) => updateFile(activeFile.filename, value)}
        />
      ) : null}
    </div>
  );
}
