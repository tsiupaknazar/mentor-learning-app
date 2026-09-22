import { describe, expect, it } from "vitest";
import {
  MENTOR_PERSONA,
  TEAM_LEAD_PERSONA,
  buildDiagnosticPrompt,
  buildKnowledgeProfilePrompt,
  buildLearningPathPrompt,
  buildPracticeProblemSetPrompt,
  buildExercisePrompt,
  buildEvaluationPrompt,
  buildFollowUpReactionPrompt,
  buildConceptPrompt,
  buildProjectPlanPrompt,
  buildProjectIdeasPrompt,
  buildLearningPathTranslationPrompt,
  buildProjectTranslationPrompt,
  buildExerciseTranslationPrompt,
  buildMistakeTranslationPrompt,
  buildCodeReviewPrompt,
  buildHintPrompt,
} from "@/lib/prompts";
import type { Exercise } from "@/lib/schemas";
import type { LearnerContext } from "@/types/domain";

function ctx(overrides: Partial<LearnerContext> = {}): LearnerContext {
  return {
    level: "junior",
    learningGoal: "improve_skills",
    learningStyle: "balanced",
    locale: "en",
    currentTopics: [],
    weakTopics: [],
    strongTopics: [],
    recurringMistakes: [],
    recentPerformance: 50,
    pathSubject: null,
    ...overrides,
  };
}

const EXERCISE: Exercise = {
  id: "ex1",
  topic: "JavaScript",
  subtopic: "closures",
  type: "debugging",
  difficulty: "medium",
  language: "javascript",
  title: "Fix the counter",
  prompt: "Fix the bug.",
  starterCode: null,
  choices: null,
  testCases: null,
  referenceSolution: "function counter() {}",
};

describe("languageInstruction (via any builder)", () => {
  it("adds no language instruction for en", () => {
    const { system } = buildConceptPrompt(ctx({ locale: "en" }), "JS", "closures");
    expect(system).not.toContain("LANGUAGE:");
  });

  it("adds a Ukrainian language instruction for uk", () => {
    const { system } = buildConceptPrompt(ctx({ locale: "uk" }), "JS", "closures");
    expect(system).toContain("LANGUAGE:");
    expect(system).toContain("Ukrainian");
  });
});

describe("buildDiagnosticPrompt", () => {
  it("includes the topic and self-reported level", () => {
    const { prompt } = buildDiagnosticPrompt("SQL", "beginner");
    expect(prompt).toContain("Topic: SQL");
    expect(prompt).toContain("beginner");
  });
});

describe("buildDiagnosticPrompt: for someone who doesn't know their level", () => {
  it("opens gently and saves the coding tasks for later", () => {
    const { prompt } = buildDiagnosticPrompt("JavaScript", "not_sure");
    expect(prompt).toContain("may never have written code");
    expect(prompt).toContain("very gentle to demanding");
  });

  it("is unchanged for someone who chose a level", () => {
    expect(buildDiagnosticPrompt("JavaScript", "junior").prompt).not.toContain("very gentle");
  });
});

describe("buildKnowledgeProfilePrompt", () => {
  it("embeds the answered questions as JSON", () => {
    const { prompt } = buildKnowledgeProfilePrompt("SQL", [
      { prompt: "What is a JOIN?", type: "knowledge", subtopic: "joins", answer: "combines tables" },
    ]);
    expect(prompt).toContain("What is a JOIN?");
    expect(prompt).toContain("SQL");
  });
});

describe("buildLearningPathPrompt", () => {
  it("weights toward weak topics when present", () => {
    const { prompt } = buildLearningPathPrompt(ctx({ weakTopics: ["Recursion"] }), "JavaScript", null);
    expect(prompt).toContain("weak areas: Recursion");
  });

  it("falls back to foundational-concepts framing with no weak topics", () => {
    const { prompt } = buildLearningPathPrompt(ctx(), "JavaScript", null);
    expect(prompt).toContain("foundational concepts");
  });

  it("mentions there was no diagnostic when knowledgeProfile is null", () => {
    const { prompt } = buildLearningPathPrompt(ctx(), "JavaScript", null);
    expect(prompt).toContain("no diagnostic was taken");
  });
});

describe("buildLearningPathPrompt: for a beginner", () => {
  it("asks for the smallest steps, starting from nothing", () => {
    const { prompt } = buildLearningPathPrompt(ctx({ level: "beginner" }), "HTML & CSS", null);
    expect(prompt).toContain("ABSOLUTE BEGINNER");
    expect(prompt).toContain("one new idea per topic");
  });

  it("doesn't for anyone else", () => {
    expect(buildLearningPathPrompt(ctx({ level: "junior" }), "HTML & CSS", null).prompt).not.toContain("ABSOLUTE BEGINNER");
  });
});

describe("buildPracticeProblemSetPrompt", () => {
  it("states a required language per topic when given one", () => {
    const { prompt } = buildPracticeProblemSetPrompt(
      ctx(),
      [{ title: "CSS Flexbox", language: "css" }],
      { easy: 1, medium: 1, hard: 0 },
      []
    );
    expect(prompt).toContain('language MUST be "css"');
    expect(prompt).toContain("2 problems total");
  });

  it("leaves language to judgment when none is given", () => {
    const { prompt } = buildPracticeProblemSetPrompt(
      ctx(),
      [{ title: "Algorithms", language: null }],
      { easy: 1, medium: 0, hard: 0 },
      ["Two Sum"]
    );
    expect(prompt).toContain("pick whichever language genuinely fits");
    expect(prompt).toContain("Two Sum");
  });
});

describe("buildExercisePrompt", () => {
  it("states a hard language requirement when one is required", () => {
    const { prompt } = buildExercisePrompt(ctx(), "SQL", "joins", "medium", [], "sql");
    expect(prompt).toContain('Language MUST be "sql"');
  });

  it("leaves language to judgment when none is required", () => {
    const { prompt } = buildExercisePrompt(ctx(), "Algorithms", "big-o", "medium", [], null);
    expect(prompt).toContain("Pick whichever of javascript/typescript/html/css/python/sql");
  });

  it("scopes the exercise strictly to the given subtopic", () => {
    const { prompt } = buildExercisePrompt(ctx(), "JS", "closures", "hard", [], null);
    expect(prompt).toContain('test ONLY "closures"');
  });
});

describe("buildEvaluationPrompt", () => {
  it("includes the mentor persona and the reference solution, never exposing it as the answer", () => {
    const { system, prompt } = buildEvaluationPrompt(ctx(), EXERCISE, "my answer");
    expect(system).toContain(MENTOR_PERSONA);
    expect(prompt).toContain(EXERCISE.referenceSolution);
    expect(prompt).toContain("my answer");
  });
});

describe("buildFollowUpReactionPrompt", () => {
  it("includes the original follow-up question and the learner's reply", () => {
    const { prompt } = buildFollowUpReactionPrompt(
      ctx(),
      { title: EXERCISE.title, prompt: EXERCISE.prompt },
      "Why is that easier?",
      "Because it's shorter"
    );
    expect(prompt).toContain("Why is that easier?");
    expect(prompt).toContain("Because it's shorter");
  });
});

describe("buildConceptPrompt", () => {
  it("asks for brevity when learning style is more_practice", () => {
    const { prompt } = buildConceptPrompt(ctx({ learningStyle: "more_practice" }), "JS", "closures");
    expect(prompt).toContain("keep this genuinely brief");
  });

  it("allows slightly more depth for more_theory", () => {
    const { prompt } = buildConceptPrompt(ctx({ learningStyle: "more_theory" }), "JS", "closures");
    expect(prompt).toContain("go slightly deeper");
  });

  it("uses the balanced default otherwise", () => {
    const { prompt } = buildConceptPrompt(ctx({ learningStyle: "balanced" }), "JS", "closures");
    expect(prompt).toContain("not a lecture");
  });

  it("keeps the quick concept, with no lesson sections, above beginner level", () => {
    for (const level of ["junior", "intermediate", "advanced"] as const) {
      const { system, prompt } = buildConceptPrompt(ctx({ level }), "JS", "closures");
      expect(system).toContain("NOT a full lesson");
      expect(prompt).toContain('Set "sections" to an empty array');
    }
  });

  it("follows the requested depth over the learner's level, but keeps the level's own framing", () => {
    const full = buildConceptPrompt(ctx({ level: "advanced" }), "JS", "closures", "full");
    expect(full.system).not.toContain("NOT a full lesson");
    expect(full.system).not.toContain("ABSOLUTE BEGINNER");
    expect(full.system).toContain("skip remedial explanation");
    const quick = buildConceptPrompt(ctx({ level: "beginner" }), "JS", "closures", "quick");
    expect(quick.system).toContain("NOT a full lesson");
    expect(quick.system).toContain("may have never written code");
  });

  it("pitches the quick concept differently for each level", () => {
    const guidanceFor = (level: "beginner" | "junior" | "intermediate" | "advanced") =>
      buildConceptPrompt(ctx({ level }), "JS", "closures").system;
    expect(guidanceFor("beginner")).toContain("may have never written code");
    expect(guidanceFor("junior")).toContain("shaky on fundamentals");
    expect(guidanceFor("intermediate")).toContain("assume solid fundamentals");
    expect(guidanceFor("advanced")).toContain("skip remedial explanation");
  });

  it("pitches a full lesson differently for each level, not just beginner", () => {
    const guidanceFor = (level: "beginner" | "junior" | "intermediate" | "advanced") =>
      buildConceptPrompt(ctx({ level }), "JS", "closures", "full").system;
    expect(guidanceFor("junior")).toContain("shaky on fundamentals");
    expect(guidanceFor("junior")).not.toContain("ABSOLUTE BEGINNER");
    expect(guidanceFor("intermediate")).toContain("assume solid fundamentals");
    expect(guidanceFor("advanced")).toContain("skip remedial explanation");
  });

  it("describes the learner by level and style only, so the shared result holds nothing personal", () => {
    const personal = ctx({
      level: "beginner",
      weakTopics: ["SECRET_WEAK_TOPIC"],
      strongTopics: ["SECRET_STRONG_TOPIC"],
      recurringMistakes: ["SECRET_MISTAKE"],
      recentPerformance: 73,
      pathSubject: "SECRET_SUBJECT",
    });
    for (const depth of ["quick", "full"] as const) {
      const { prompt } = buildConceptPrompt(personal, "JS", "closures", depth);
      expect(prompt).not.toMatch(/SECRET|73/);
    }
  });

  describe("for a beginner", () => {
    it("asks for a self-check on each section, and a language for the examples", () => {
      const { prompt } = buildConceptPrompt(ctx({ level: "beginner" }), "HTML", "Headings");
      expect(prompt).toContain('"check"');
      expect(prompt).toContain("correctIndex");
      expect(prompt).toContain('"language"');
    });

    it("asks for a guided multi-section lesson that assumes no prior knowledge", () => {
      const { system, prompt } = buildConceptPrompt(ctx({ level: "beginner" }), "HTML", "Headings");
      expect(system).toContain("ABSOLUTE BEGINNER");
      expect(system).not.toContain("NOT a full lesson");
      expect(prompt).toContain('"sections": 4-5 short sections');
      expect(prompt).toContain("teach ONLY \"Headings\"");
      expect(prompt).not.toContain('Set "sections" to an empty array');
    });

    it("scales the number of sections with the learning style", () => {
      const sections = (learningStyle: "more_practice" | "balanced" | "more_theory") =>
        buildConceptPrompt(ctx({ level: "beginner", learningStyle }), "JS", "closures").prompt;
      expect(sections("more_practice")).toContain("3-4 short sections");
      expect(sections("balanced")).toContain("4-5 short sections");
      expect(sections("more_theory")).toContain("5-6 short sections");
    });

    it("still writes in the learner's language", () => {
      const { system } = buildConceptPrompt(ctx({ level: "beginner", locale: "uk" }), "JS", "closures");
      expect(system).toContain("LANGUAGE:");
      expect(system).toContain("Ukrainian");
    });
  });
});

describe("buildExercisePrompt: learning style and scaffolding", () => {
  const build = (overrides = {}, scaffold: 0 | 1 | null = null) =>
    buildExercisePrompt(ctx(overrides), "JS", "closures", "easy", [], null, scaffold).prompt;

  it("leans toward reasoning exercises for more_theory and hands-on ones for more_practice", () => {
    expect(build({ learningStyle: "more_theory" })).toContain("explain_code");
    expect(build({ learningStyle: "more_theory" })).toContain("understanding over drilling");
    expect(build({ learningStyle: "more_practice" })).toContain("hands-on practice");
  });

  it("adds no nudge for balanced", () => {
    const prompt = build({ learningStyle: "balanced" });
    expect(prompt).not.toContain("understanding over drilling");
    expect(prompt).not.toContain("hands-on practice");
  });

  it("nudges the practice-problem batch the same way", () => {
    const { prompt } = buildPracticeProblemSetPrompt(
      ctx({ learningStyle: "more_practice" }),
      [{ title: "Closures", language: null }],
      { easy: 1, medium: 1, hard: 1 },
      []
    );
    expect(prompt).toContain("hands-on practice");
  });

  it("scaffolds a first exercise as a worked example, and a second as a skeleton", () => {
    expect(build({}, 0)).toContain("ONE clearly marked blank");
    expect(build({}, 1)).toContain("fade the support");
    expect(build({}, null)).not.toContain("SCAFFOLDING");
  });
});

describe("beginner-appropriate exercises and tone", () => {
  const BEGINNER = { level: "beginner" as const };

  it("restricts a beginner to exercise types they can do, for single exercises and the batch", () => {
    const single = buildExercisePrompt(ctx(BEGINNER), "JS", "loops", "easy", [], null).prompt;
    const batch = buildPracticeProblemSetPrompt(ctx(BEGINNER), [{ title: "Loops", language: null }], { easy: 1, medium: 1, hard: 1 }, []).prompt;
    for (const prompt of [single, batch]) {
      expect(prompt).toContain("ABSOLUTE BEGINNER");
      expect(prompt).toContain("never architecture_decision");
      expect(prompt).toContain("under about 15 lines");
    }
  });

  it("doesn't restrict anyone else", () => {
    for (const level of ["junior", "intermediate", "advanced"] as const) {
      expect(buildExercisePrompt(ctx({ level }), "JS", "loops", "easy", [], null).prompt).not.toContain("ABSOLUTE BEGINNER");
    }
  });

  it("softens the delivery of a beginner's review, hint and follow-up, without dropping the mentor's honesty", () => {
    const reviews = [
      buildEvaluationPrompt(ctx(BEGINNER), EXERCISE, "answer").system,
      buildHintPrompt(EXERCISE, "direction", null, "en", "beginner").system,
      buildFollowUpReactionPrompt(ctx(BEGINNER), EXERCISE, "Why?", "because").system,
    ];
    for (const system of reviews) {
      expect(system).toContain("ABSOLUTE BEGINNER");
      expect(system).toContain("Never give unearned praise");
    }
  });

  it("keeps the demanding mentor for everyone else", () => {
    expect(buildEvaluationPrompt(ctx({ level: "junior" }), EXERCISE, "answer").system).not.toContain("ABSOLUTE BEGINNER");
    expect(buildHintPrompt(EXERCISE, "direction", null, "en", "advanced").system).not.toContain("ABSOLUTE BEGINNER");
    expect(buildHintPrompt(EXERCISE, "direction", null).system).not.toContain("ABSOLUTE BEGINNER");
  });
});

describe("CSS exercises carry their own markup for the preview", () => {
  it("asks for previewMarkup on single exercises and on the practice batch", () => {
    const single = buildExercisePrompt(ctx(), "CSS", "Selectors", "easy", [], "css").prompt;
    expect(single).toContain('"previewMarkup"');
    const batch = buildPracticeProblemSetPrompt(ctx(), [{ title: "CSS", language: "css" }], { easy: 1, medium: 1, hard: 1 }, []).prompt;
    expect(batch).toContain('"previewMarkup"');
  });
});

describe("test cases the app can run", () => {
  it("asks JavaScript exercises for calls and JSON values, on both prompts", () => {
    const single = buildExercisePrompt(ctx(), "JS", "sum", "easy", [], "javascript").prompt;
    const batch = buildPracticeProblemSetPrompt(ctx(), [{ title: "JS", language: "javascript" }], { easy: 1, medium: 1, hard: 1 }, []).prompt;
    for (const prompt of [single, batch]) {
      expect(prompt).toContain('"sum(2, 3)"');
      expect(prompt).toContain("JSON of the value");
    }
  });
});

describe("buildEvaluationPrompt: test results", () => {
  const passing = { input: "sum(2, 3)", expected: "5", actual: "5", passed: true, error: null };
  const failing = { input: "sum(2, 2)", expected: "5", actual: "4", passed: false, error: null };

  it("puts the results in front of the reviewer, and tells it not to fail code that passes", () => {
    const { prompt } = buildEvaluationPrompt(ctx(), EXERCISE, "answer", [], [passing]);
    expect(prompt).toContain('"call":"sum(2, 3)"');
    expect(prompt).toContain("Every case passed");
    expect(prompt).toContain("client-reported");
  });

  it("asks to name the failing case when some fail", () => {
    const { prompt } = buildEvaluationPrompt(ctx(), EXERCISE, "answer", [], [passing, failing]);
    expect(prompt).toContain("Some cases failed");
    expect(prompt).not.toContain("Every case passed");
  });

  it("says nothing about tests when none were run", () => {
    expect(buildEvaluationPrompt(ctx(), EXERCISE, "answer").prompt).not.toContain("test cases in their browser");
  });
});

describe("buildEvaluationPrompt: lesson sections", () => {
  it("offers the headings to trace a mistake back to", () => {
    const { prompt } = buildEvaluationPrompt(ctx(), EXERCISE, "answer", ["What is a tag?"]);
    expect(prompt).toContain('["What is a tag?"]');
    expect(prompt).toContain("EXACTLY as written");
  });

  it("tells the model there is nothing to point at when no lesson was shown", () => {
    expect(buildEvaluationPrompt(ctx(), EXERCISE, "answer").prompt).toContain('Set "relatedLessonSection" to null');
  });
});

describe("buildProjectPlanPrompt", () => {
  it("adds a required-scope constraint for a markup-only topic", () => {
    const { system, prompt } = buildProjectPlanPrompt(ctx(), "CSS Flexbox", "beginner");
    expect(system).toContain("never write any code or file content");
    expect(prompt).toContain("REQUIRED SCOPE");
    expect(prompt).toContain("html, css");
  });

  it("adds no scope constraint for a general topic", () => {
    const { prompt } = buildProjectPlanPrompt(ctx(), "Node.js REST APIs", "intermediate");
    expect(prompt).not.toContain("REQUIRED SCOPE");
  });

  it("adds a correction line on retry after a scope violation", () => {
    const { prompt } = buildProjectPlanPrompt(ctx(), "CSS Flexbox", "beginner", {
      attemptedLanguages: ["javascript"],
      requiredScope: ["html", "css"],
    });
    expect(prompt).toContain("CORRECTION REQUIRED");
    expect(prompt).toContain("javascript");
  });
});

describe("buildProjectIdeasPrompt", () => {
  it("grounds ideas in the existing path when one exists", () => {
    const { prompt } = buildProjectIdeasPrompt(ctx({ currentTopics: ["Closures"] }), "junior");
    expect(prompt).toContain("Ground each idea in a topic from their current learning path");
  });

  it("falls back to well-rounded topics with no established path", () => {
    const { prompt } = buildProjectIdeasPrompt(ctx(), "junior");
    expect(prompt).toContain("don't have an established learning path yet");
  });

  it("scopes ideas when the active path is markup-only", () => {
    const { prompt } = buildProjectIdeasPrompt(ctx({ pathSubject: "HTML/CSS" }), "beginner");
    expect(prompt).toContain("REQUIRED SCOPE");
  });
});

describe("translation prompt builders", () => {
  it("buildLearningPathTranslationPrompt embeds the bundle and target language", () => {
    const { prompt } = buildLearningPathTranslationPrompt(
      { title: "JS Path", rationale: "r", knowledgeProfileSummary: null, topics: [] },
      "uk"
    );
    expect(prompt).toContain("JS Path");
    expect(prompt).toContain("Ukrainian");
  });

  it("buildProjectTranslationPrompt embeds the bundle", () => {
    const { prompt } = buildProjectTranslationPrompt(
      { title: "Kanban", description: "d", tasks: [] },
      "uk"
    );
    expect(prompt).toContain("Kanban");
  });

  it("buildExerciseTranslationPrompt embeds every exercise's id", () => {
    const { prompt } = buildExerciseTranslationPrompt(
      [{ id: "ex1", title: "t", subtopic: "s", prompt: "p", choices: null }],
      "uk"
    );
    expect(prompt).toContain('"id": "ex1"');
  });

  it("buildMistakeTranslationPrompt embeds every mistake's id", () => {
    const { prompt } = buildMistakeTranslationPrompt([{ id: "m1", description: "d" }], "uk");
    expect(prompt).toContain('"id": "m1"');
  });
});

describe("buildCodeReviewPrompt", () => {
  it("includes the task requirements and every submitted file", () => {
    const { system, prompt } = buildCodeReviewPrompt(
      ctx(),
      { taskCode: "FE-101", title: "Build the form", requirements: ["validates email"] },
      [{ filename: "index.html", content: "<form></form>" }],
      null
    );
    expect(system).toContain(MENTOR_PERSONA);
    expect(prompt).toContain("validates email");
    expect(prompt).toContain("index.html");
    expect(prompt).toContain("This is the first submission for this task.");
  });

  it("asks whether previous review comments were actually addressed on resubmission", () => {
    const { prompt } = buildCodeReviewPrompt(
      ctx(),
      { taskCode: "FE-101", title: "Build the form", requirements: ["validates email"] },
      [{ filename: "index.html", content: "<form></form>" }],
      { summary: "Missing validation", comments: [{ severity: "blocking", comment: "no validation" }] }
    );
    expect(prompt).toContain("Missing validation");
    expect(prompt).toContain("Check specifically whether THIS submission actually addresses");
  });
});

describe("buildHintPrompt", () => {
  it("uses the direction-level instruction and never reveals the fix", () => {
    const { prompt } = buildHintPrompt(EXERCISE, "direction", null);
    expect(prompt).toContain("Do not describe the bug or the approach");
    expect(prompt).toContain("(no attempt yet)");
  });

  it("uses the strong_hint-level instruction while still withholding the full solution", () => {
    const { prompt } = buildHintPrompt(EXERCISE, "strong_hint", "my attempt so far");
    expect(prompt).toContain("do NOT write the complete implementation");
    expect(prompt).toContain("my attempt so far");
  });
});

describe("shared persona constants", () => {
  it("MENTOR_PERSONA forbids unearned praise", () => {
    expect(MENTOR_PERSONA).toContain("Never give unearned praise");
  });

  it("TEAM_LEAD_PERSONA frames work as real engineering tickets", () => {
    expect(TEAM_LEAD_PERSONA).toContain("Team Lead");
  });
});
