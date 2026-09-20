import { describe, expect, it } from "vitest";
import {
  conceptSchema,
  DIAGNOSTIC_QUESTION_COUNT,
  diagnosticSetSchema,
  diagnosticQuestionSchema,
  exerciseSchema,
  evaluationSchema,
  learningPathSchema,
} from "@/lib/schemas";

const VALID_QUESTION = {
  id: "q1",
  type: "knowledge",
  subtopic: "closures",
  prompt: "What is a closure?",
};

const VALID_EXERCISE = {
  id: "ex1",
  topic: "JavaScript",
  subtopic: "closures",
  type: "debugging",
  difficulty: "medium",
  language: "javascript",
  title: "Fix the counter",
  prompt: "Fix the bug in this counter.",
  referenceSolution: "function counter() {}",
};

const VALID_EVALUATION = {
  result: "correct",
  scores: {
    correctness: 100,
    logic: 100,
    codeQuality: 100,
    bestPractices: 100,
    edgeCaseHandling: 100,
  },
  whatYouDid: "Fixed the loop bound.",
  nextStep: "Try a harder one.",
};

describe("looseNullable (via conceptSchema.example)", () => {
  const base = {
    topic: "JavaScript",
    subtopic: "closures",
    explanation: "A closure captures its lexical scope.",
    keyPoints: ["Captures scope", "Persists after the outer function returns"],
  };

  it("accepts a missing key as null", () => {
    const result = conceptSchema.parse({ ...base });
    expect(result.example).toBeNull();
  });

  it("accepts an explicit null", () => {
    const result = conceptSchema.parse({ ...base, example: null });
    expect(result.example).toBeNull();
  });

  it("accepts a real value unchanged", () => {
    const example = { code: "const x = 1;", explanation: "A constant." };
    const result = conceptSchema.parse({ ...base, example });
    expect(result.example).toEqual(example);
  });
});

describe("conceptSchema.sections (the beginner lesson)", () => {
  const base = {
    topic: "HTML",
    subtopic: "Headings",
    explanation: "Headings title a section.",
    keyPoints: ["h1 is the biggest", "One h1 per page"],
  };

  it("is optional, so a concept cached before lessons existed still parses", () => {
    expect(conceptSchema.parse(base).sections).toBeUndefined();
  });

  it("accepts sections, normalizing a missing example to null", () => {
    const result = conceptSchema.parse({
      ...base,
      language: "html",
      sections: [{ heading: "What is a tag?", body: "It labels content." }],
    });
    expect(result.sections).toEqual([{ heading: "What is a tag?", body: "It labels content.", example: null, check: null }]);
    expect(result.language).toBe("html");
  });

  const section = { heading: "What is a tag?", body: "It labels content." };
  const check = { question: "Which is a tag?", choices: ["<p>", "p"], correctIndex: 0, explanation: "Tags have angle brackets." };

  it("keeps a well-formed self-check on a section", () => {
    const result = conceptSchema.parse({ ...base, sections: [{ ...section, check }] });
    expect(result.sections![0]!.check).toEqual(check);
  });

  it("treats a missing self-check as none", () => {
    expect(conceptSchema.parse({ ...base, sections: [section] }).sections![0]!.check).toBeNull();
  });

  it("drops a malformed self-check instead of failing the whole lesson", () => {
    const outOfRange = { ...check, correctIndex: 3 };
    const tooFewChoices = { ...check, choices: ["<p>"] };
    for (const bad of [outOfRange, tooFewChoices, { question: "q" }, "nonsense"]) {
      const result = conceptSchema.parse({ ...base, sections: [{ ...section, check: bad }] });
      expect(result.sections![0]!.check).toBeNull();
      expect(result.sections![0]!.heading).toBe("What is a tag?");
    }
  });

  it("rejects a section without a heading or body", () => {
    expect(() => conceptSchema.parse({ ...base, sections: [{ heading: "", body: "x" }] })).toThrow();
    expect(() => conceptSchema.parse({ ...base, sections: [{ heading: "x", body: "" }] })).toThrow();
  });
});

describe("DIAGNOSTIC_QUESTION_COUNT bound, shared by diagnosticSetSchema", () => {
  it("rejects fewer questions than the minimum", () => {
    const tooFew = Array.from({ length: DIAGNOSTIC_QUESTION_COUNT.min - 1 }, (_, i) => ({
      ...VALID_QUESTION,
      id: `q${i}`,
    }));
    expect(diagnosticSetSchema.safeParse({ topic: "JS", questions: tooFew }).success).toBe(false);
  });

  it("accepts exactly the minimum and maximum question counts", () => {
    const min = Array.from({ length: DIAGNOSTIC_QUESTION_COUNT.min }, (_, i) => ({
      ...VALID_QUESTION,
      id: `q${i}`,
    }));
    const max = Array.from({ length: DIAGNOSTIC_QUESTION_COUNT.max }, (_, i) => ({
      ...VALID_QUESTION,
      id: `q${i}`,
    }));
    expect(diagnosticSetSchema.safeParse({ topic: "JS", questions: min }).success).toBe(true);
    expect(diagnosticSetSchema.safeParse({ topic: "JS", questions: max }).success).toBe(true);
  });

  it("rejects more questions than the maximum", () => {
    const tooMany = Array.from({ length: DIAGNOSTIC_QUESTION_COUNT.max + 1 }, (_, i) => ({
      ...VALID_QUESTION,
      id: `q${i}`,
    }));
    expect(diagnosticSetSchema.safeParse({ topic: "JS", questions: tooMany }).success).toBe(false);
  });

  it("diagnosticQuestionSchema itself accepts a missing codeSnippet/choices", () => {
    const parsed = diagnosticQuestionSchema.parse(VALID_QUESTION);
    expect(parsed.codeSnippet).toBeNull();
    expect(parsed.choices).toBeNull();
  });
});

describe("exerciseSchema", () => {
  it("accepts a minimal valid exercise", () => {
    expect(exerciseSchema.safeParse(VALID_EXERCISE).success).toBe(true);
  });

  it("rejects an unknown exercise type", () => {
    expect(
      exerciseSchema.safeParse({ ...VALID_EXERCISE, type: "not_a_real_type" }).success
    ).toBe(false);
  });

  it("rejects an unknown programming language", () => {
    expect(exerciseSchema.safeParse({ ...VALID_EXERCISE, language: "cobol" }).success).toBe(
      false
    );
  });

  it("normalizes missing starterCode/choices/testCases to null", () => {
    const parsed = exerciseSchema.parse(VALID_EXERCISE);
    expect(parsed.starterCode).toBeNull();
    expect(parsed.choices).toBeNull();
    expect(parsed.testCases).toBeNull();
  });
});

describe("evaluationSchema", () => {
  it("accepts a minimal valid evaluation", () => {
    expect(evaluationSchema.safeParse(VALID_EVALUATION).success).toBe(true);
  });

  it("rejects a score outside 0-100", () => {
    expect(
      evaluationSchema.safeParse({
        ...VALID_EVALUATION,
        scores: { ...VALID_EVALUATION.scores, correctness: 101 },
      }).success
    ).toBe(false);
  });

  it("rejects an unknown result value", () => {
    expect(evaluationSchema.safeParse({ ...VALID_EVALUATION, result: "great_job" }).success).toBe(
      false
    );
  });

  it("normalizes every looseNullable field to null when omitted", () => {
    const parsed = evaluationSchema.parse(VALID_EVALUATION);
    expect(parsed.problem).toBeNull();
    expect(parsed.whyItMatters).toBeNull();
    expect(parsed.hint).toBeNull();
    expect(parsed.detectedMisconception).toBeNull();
    expect(parsed.detectedMisconceptionKey).toBeNull();
    expect(parsed.mentorFollowUp).toBeNull();
  });
});

describe("learningPathSchema (recursive tree)", () => {
  it("defaults a leaf node's missing prerequisiteIds/children to []", () => {
    const parsed = learningPathSchema.parse({
      title: "JS path",
      rationale: "because",
      topics: [{ id: "t1", title: "Closures", summary: "Closures summary" }],
    });
    expect(parsed.topics[0]!.prerequisiteIds).toEqual([]);
    expect(parsed.topics[0]!.children).toEqual([]);
  });

  it("recurses into nested children", () => {
    const parsed = learningPathSchema.parse({
      title: "JS path",
      rationale: "because",
      topics: [
        {
          id: "t1",
          title: "Functions",
          summary: "Functions summary",
          children: [{ id: "t1a", title: "Closures", summary: "Closures summary" }],
        },
      ],
    });
    expect(parsed.topics[0]!.children).toHaveLength(1);
    expect(parsed.topics[0]!.children[0]!.id).toBe("t1a");
    expect(parsed.topics[0]!.children[0]!.children).toEqual([]);
  });
});
