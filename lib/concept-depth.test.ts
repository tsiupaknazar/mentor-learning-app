import { describe, expect, it } from "vitest";
import { CONCEPT_PROMPT_VERSION, conceptCacheKey, defaultConceptDepth } from "@/lib/concept-depth";

describe("defaultConceptDepth", () => {
  it("gives a beginner the full lesson until they're familiar with the topic", () => {
    expect(defaultConceptDepth("beginner", 0)).toBe("full");
    expect(defaultConceptDepth("beginner", 40)).toBe("full");
    expect(defaultConceptDepth("beginner", 60)).toBe("quick");
  });

  it("gives anyone else the full lesson only for a topic they've never touched", () => {
    for (const level of ["junior", "intermediate", "advanced"] as const) {
      expect(defaultConceptDepth(level, 0)).toBe("full");
      expect(defaultConceptDepth(level, 20)).toBe("quick");
    }
  });
});

describe("conceptCacheKey", () => {
  const base = { topic: "HTML", subtopic: "Headings", depth: "full", level: "beginner", style: "balanced", locale: "en" } as const;

  it("is stable across case and spacing in the topic names", () => {
    expect(conceptCacheKey({ ...base, topic: "  html ", subtopic: "HEADINGS  " })).toBe(conceptCacheKey(base));
    expect(conceptCacheKey({ ...base, subtopic: "Heading   levels" })).toBe(conceptCacheKey({ ...base, subtopic: "heading levels" }));
  });

  it("differs for every input the prompt depends on", () => {
    const keys = [
      base,
      { ...base, topic: "CSS" },
      { ...base, subtopic: "Lists" },
      { ...base, depth: "quick" },
      { ...base, level: "junior" },
      { ...base, style: "more_theory" },
      { ...base, locale: "uk" },
    ].map((p) => conceptCacheKey(p as typeof base));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries the prompt version, so a rewritten prompt stops serving old lessons", () => {
    expect(conceptCacheKey(base).startsWith(`v${CONCEPT_PROMPT_VERSION}|`)).toBe(true);
  });
});
