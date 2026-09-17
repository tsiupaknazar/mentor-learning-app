import { describe, expect, it } from "vitest";
import {
  languageExtension,
  defaultFilename,
  languageFromFilename,
} from "@/lib/code-languages";
import type { ProgrammingLanguage } from "@/types/domain";

const ALL_LANGUAGES: ProgrammingLanguage[] = [
  "javascript",
  "typescript",
  "html",
  "css",
  "python",
  "sql",
];

describe("languageExtension", () => {
  it("returns a CodeMirror extension for every supported language", () => {
    for (const language of ALL_LANGUAGES) {
      expect(languageExtension(language)).toBeTruthy();
    }
  });
});

describe("defaultFilename", () => {
  it("returns the expected filename per language", () => {
    expect(defaultFilename("javascript")).toBe("script.js");
    expect(defaultFilename("typescript")).toBe("script.ts");
    expect(defaultFilename("html")).toBe("index.html");
    expect(defaultFilename("css")).toBe("styles.css");
    expect(defaultFilename("python")).toBe("main.py");
    expect(defaultFilename("sql")).toBe("query.sql");
  });
});

describe("languageFromFilename", () => {
  it("maps known extensions to their language", () => {
    expect(languageFromFilename("app.ts")).toBe("typescript");
    expect(languageFromFilename("component.tsx")).toBe("typescript");
    expect(languageFromFilename("index.html")).toBe("html");
    expect(languageFromFilename("page.htm")).toBe("html");
    expect(languageFromFilename("styles.css")).toBe("css");
    expect(languageFromFilename("main.py")).toBe("python");
    expect(languageFromFilename("query.sql")).toBe("sql");
  });

  it("falls back to javascript for unknown or missing extensions", () => {
    expect(languageFromFilename("script.js")).toBe("javascript");
    expect(languageFromFilename("README")).toBe("javascript");
    expect(languageFromFilename("archive.tar.gz")).toBe("javascript");
  });

  it("is case-insensitive on the extension", () => {
    expect(languageFromFilename("Main.PY")).toBe("python");
  });
});
