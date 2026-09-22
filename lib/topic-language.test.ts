import { describe, expect, it } from "vitest";
import {
  inferTopicLanguage,
  resolveTopicLanguage,
  resolveProjectLanguageScope,
} from "@/lib/topic-language";

describe("inferTopicLanguage", () => {
  it("matches TypeScript before the broader JavaScript pattern", () => {
    expect(inferTopicLanguage("TypeScript Generics")).toBe("typescript");
    expect(inferTopicLanguage("TS utility types")).toBe("typescript");
  });

  it("matches JavaScript-family topics", () => {
    expect(inferTopicLanguage("JavaScript Closures")).toBe("javascript");
    expect(inferTopicLanguage("React Hooks")).toBe("javascript");
    expect(inferTopicLanguage("Node.js Streams")).toBe("javascript");
  });

  it("matches HTML, CSS, Python, SQL, and Java topics", () => {
    expect(inferTopicLanguage("HTML Semantics")).toBe("html");
    expect(inferTopicLanguage("CSS Flexbox")).toBe("css");
    expect(inferTopicLanguage("Python Decorators")).toBe("python");
    expect(inferTopicLanguage("SQL Joins")).toBe("sql");
    expect(inferTopicLanguage("Java Generics")).toBe("java");
    expect(inferTopicLanguage("Spring Boot Basics")).toBe("java");
  });

  it("doesn't mistake JavaScript for Java", () => {
    expect(inferTopicLanguage("JavaScript Closures")).toBe("javascript");
    expect(inferTopicLanguage("Java")).toBe("java");
  });

  it("returns null for a language-agnostic topic", () => {
    expect(inferTopicLanguage("System Design")).toBeNull();
    expect(inferTopicLanguage("Algorithms")).toBeNull();
  });
});

describe("resolveTopicLanguage", () => {
  it("prefers the topic's own language over the path's", () => {
    expect(resolveTopicLanguage("Python Decorators", "JavaScript")).toBe("python");
  });

  it("falls back to the path subject when the topic names no language", () => {
    expect(resolveTopicLanguage("Loops", "JavaScript")).toBe("javascript");
  });

  it("returns null when neither the topic nor the path names a language", () => {
    expect(resolveTopicLanguage("Big-O Notation", "Algorithms")).toBeNull();
    expect(resolveTopicLanguage("Big-O Notation", null)).toBeNull();
  });
});

describe("resolveProjectLanguageScope", () => {
  it("scopes to html/css when the topic is markup-only", () => {
    expect(resolveProjectLanguageScope("CSS Flexbox layout", "Design")).toEqual(["html", "css"]);
  });

  it("does not scope when the topic mentions non-markup technology alongside markup", () => {
    expect(resolveProjectLanguageScope("CSS-in-JS with React", "Frontend")).toBeNull();
  });

  it("falls back to the path subject when the topic itself is ambiguous", () => {
    expect(resolveProjectLanguageScope("Contact form with validation", "HTML/CSS")).toEqual([
      "html",
      "css",
    ]);
  });

  it("returns null when neither topic nor path subject is markup-only", () => {
    expect(resolveProjectLanguageScope("REST API design", "Backend")).toBeNull();
    expect(resolveProjectLanguageScope("REST API design", null)).toBeNull();
  });
});
