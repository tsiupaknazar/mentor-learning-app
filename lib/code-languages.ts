import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import type { Extension } from "@codemirror/state";

import type { ProgrammingLanguage } from "@/types/domain";

const EXTENSION_BY_LANGUAGE: Record<ProgrammingLanguage, Extension> = {
  javascript: javascript({ jsx: true }),
  typescript: javascript({ jsx: true, typescript: true }),
  html: html(),
  css: css(),
  python: python(),
  sql: sql(),
};

const DEFAULT_FILENAME_BY_LANGUAGE: Record<ProgrammingLanguage, string> = {
  javascript: "script.js",
  typescript: "script.ts",
  html: "index.html",
  css: "styles.css",
  python: "main.py",
  sql: "query.sql",
};

export function languageExtension(language: ProgrammingLanguage): Extension {
  return EXTENSION_BY_LANGUAGE[language] ?? EXTENSION_BY_LANGUAGE.javascript;
}

export function defaultFilename(language: ProgrammingLanguage): string {
  return DEFAULT_FILENAME_BY_LANGUAGE[language] ?? "file.txt";
}

/** Guesses a language from a filename extension — used when a file's language isn't stored explicitly. */
export function languageFromFilename(filename: string): ProgrammingLanguage {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "py":
      return "python";
    case "sql":
      return "sql";
    default:
      return "javascript";
  }
}
