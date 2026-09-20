import { z } from "zod";

/**
 * Gemini frequently omits a field entirely instead of writing an explicit
 * `null` for "not applicable" (e.g. no code snippet on a pure knowledge
 * question). Zod's `.nullable()` alone rejects that — the key is missing,
 * not null — which was the root cause of the diagnostic/exercise/evaluate
 * routes intermittently 502'ing. `looseNullable` accepts either shape and
 * normalizes both to `null`.
 */
function looseNullable<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .nullish()
    .transform((v) => v ?? null);
}

/**
 * Every value that crosses the Gemini boundary is validated against one of
 * these schemas before it touches application state (see section 19 of the
 * product spec: "AI-generated data must never be trusted blindly"). If a
 * Gemini response fails validation, `lib/gemini.ts` retries once with the
 * validation error fed back into the prompt, then throws — callers must
 * treat AI routes as fallible.
 */

export const skillLevelSchema = z.enum(["beginner", "junior", "intermediate", "advanced"]);

export const learningGoalSchema = z.enum([
  "first_job",
  "interview_prep",
  "improve_skills",
  "learn_new_tech",
  "production_skills",
  "master_topic",
]);

export const learningStyleSchema = z.enum(["more_practice", "balanced", "more_theory"]);

export const dailyTimeSchema = z.enum(["15min", "30min", "1hr", "2hr_plus"]);

export const exerciseTypeSchema = z.enum([
  "multiple_choice",
  "code_prediction",
  "code_completion",
  "debugging",
  "refactoring",
  "implementation",
  "architecture_decision",
  "explain_code",
  "find_the_bug",
  "compare_implementations",
  "optimize_code",
  "write_tests",
  "review_code",
]);

export const exerciseDifficultySchema = z.enum([
  "easy",
  "medium",
  "hard",
  "interview",
  "real_world",
]);

export const programmingLanguageSchema = z.enum([
  "javascript",
  "typescript",
  "html",
  "css",
  "python",
  "sql",
]);

export const diagnosticQuestionTypeSchema = z.enum([
  "knowledge",
  "code_reading",
  "debugging",
  "implementation",
  "explanation",
]);

// ---------------------------------------------------------------------------
// Diagnostic assessment (section 4)
// ---------------------------------------------------------------------------

export const diagnosticQuestionSchema = z.object({
  id: z.string().min(1),
  type: diagnosticQuestionTypeSchema,
  subtopic: z.string().min(1).max(80),
  prompt: z.string().min(1).max(2000),
  codeSnippet: looseNullable(z.string().max(4000)),
  choices: looseNullable(z.array(z.string().min(1).max(300)).max(6)),
});

// Shared bound between diagnostic generation and diagnostic evaluation.
// buildDiagnosticPrompt scales question count to topic breadth (a broad
// topic like "HTML/CSS" routinely lands in the 10-16 range), so the
// evaluate endpoint's answers array MUST accept up to this many too, or
// POST /api/diagnostic/evaluate 400s on any topic broad enough to generate
// more questions than the evaluate schema allowed. Keep both endpoints
// pinned to this single constant instead of hand-copied numbers.
export const DIAGNOSTIC_QUESTION_COUNT = { min: 6, max: 20 } as const;

export const diagnosticSetSchema = z.object({
  topic: z.string().min(1),
  // A fixed small count can't discriminate skill level across a broad topic
  // (e.g. "JavaScript" has far more surface area than "React Server
  // Components"). The prompt scales actual count to topic breadth; this
  // range is just the outer bound Zod enforces either way.
  questions: z
    .array(diagnosticQuestionSchema)
    .min(DIAGNOSTIC_QUESTION_COUNT.min)
    .max(DIAGNOSTIC_QUESTION_COUNT.max),
});
export type DiagnosticSet = z.infer<typeof diagnosticSetSchema>;

export const subtopicMasterySchema = z.object({
  subtopic: z.string().min(1),
  band: z.enum(["weak", "medium", "strong"]),
  rationale: z.string().min(1).max(400),
});

export const knowledgeProfileSchema = z.object({
  topic: z.string().min(1),
  subtopics: z.array(subtopicMasterySchema).min(1),
  suggestedLevel: skillLevelSchema,
  summary: z.string().min(1).max(600),
});
export type KnowledgeProfile = z.infer<typeof knowledgeProfileSchema>;

// ---------------------------------------------------------------------------
// Learning path (section 5)
// ---------------------------------------------------------------------------

export type LearningPathTopicNode = {
  id: string;
  title: string;
  summary: string;
  prerequisiteIds: string[];
  children: LearningPathTopicNode[];
};

/** Same shape, but `prerequisiteIds`/`children` are optional on input — this is what Gemini is actually allowed to send; Zod's `.default([])` fills them in before anything downstream sees the parsed value. */
type LearningPathTopicNodeInput = {
  id: string;
  title: string;
  summary: string;
  prerequisiteIds?: string[];
  children?: LearningPathTopicNodeInput[];
};

const learningPathTopicSchema: z.ZodType<
  LearningPathTopicNode,
  z.ZodTypeDef,
  LearningPathTopicNodeInput
> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    title: z.string().min(1).max(80),
    summary: z.string().min(1).max(300),
    // A leaf node legitimately has no prerequisites/children — Gemini often
    // omits the key entirely rather than writing `[]`, so both default to
    // empty instead of failing validation on a missing key.
    prerequisiteIds: z.array(z.string()).max(10).optional().default([]),
    children: z.array(learningPathTopicSchema).max(12).optional().default([]),
  })
);

export const learningPathSchema = z.object({
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(500),
  topics: z.array(learningPathTopicSchema).min(1).max(12),
});
export type LearningPath = z.infer<typeof learningPathSchema>;
export type LearningPathTopic = LearningPathTopicNode;

// ---------------------------------------------------------------------------
// Exercises (section 7)
// ---------------------------------------------------------------------------

export const exerciseTestCaseSchema = z.object({
  input: z.string().max(500),
  expectedOutput: z.string().max(500),
  description: looseNullable(z.string().max(200)),
});

export const exerciseSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  type: exerciseTypeSchema,
  difficulty: exerciseDifficultySchema,
  // Which language starterCode/referenceSolution are written in — a CSS
  // layout exercise and a TypeScript generics exercise need different
  // syntax highlighting, not everything forced into JavaScript.
  language: programmingLanguageSchema,
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(3000),
  starterCode: looseNullable(z.string().max(4000)),
  choices: looseNullable(z.array(z.string().min(1).max(300)).max(6)),
  testCases: looseNullable(z.array(exerciseTestCaseSchema).max(10)),
  referenceSolution: z.string().max(4000),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const practiceProblemSetSchema = z.object({
  problems: z.array(exerciseSchema).min(1).max(24),
});
export type PracticeProblemSet = z.infer<typeof practiceProblemSetSchema>;

// ---------------------------------------------------------------------------
// Evaluation / strict mentor feedback (sections 9, 10, 27)
// ---------------------------------------------------------------------------

export const scoreBreakdownSchema = z.object({
  correctness: z.number().min(0).max(100),
  logic: z.number().min(0).max(100),
  codeQuality: z.number().min(0).max(100),
  bestPractices: z.number().min(0).max(100),
  edgeCaseHandling: z.number().min(0).max(100),
});

export const evaluationSchema = z.object({
  result: z.enum(["correct", "partially_correct", "incorrect"]),
  scores: scoreBreakdownSchema,
  whatYouDid: z.string().min(1).max(500),
  problem: looseNullable(z.string().max(500)),
  whyItMatters: looseNullable(z.string().max(500)),
  hint: looseNullable(z.string().max(400)),
  nextStep: z.string().min(1).max(300),
  detectedMisconception: looseNullable(z.string().max(300)),
  // A short, stable, English identifier for the misconception (e.g.
  // "off-by-one-loop-bound", "missing-await") — kebab-case, language-
  // independent, always in English regardless of the learner's locale.
  // This is what convex/mistakes.ts actually matches recurrences on;
  // `detectedMisconception` itself is prose in the learner's locale, which
  // breaks exact-string matching the moment the learner switches
  // language, silently splitting one recurring mistake into duplicates.
  // Null whenever detectedMisconception is null.
  detectedMisconceptionKey: looseNullable(z.string().min(1).max(60)),
  // The heading of the lesson section (if any were offered to the model) that
  // covers the idea this answer got wrong, so the UI can offer "Revisit: ...".
  // The route nulls it unless it matches a real heading.
  relatedLessonSection: looseNullable(z.string().max(100)),
  mentorFollowUp: looseNullable(z.string().max(400)),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const mentorFollowUpReactionSchema = z.object({
  reaction: z.string().min(1).max(400),
  resolved: z.boolean(),
});
export type MentorFollowUpReaction = z.infer<typeof mentorFollowUpReactionSchema>;

export const hintSchema = z.object({
  level: z.enum(["direction", "specific_problem", "strong_hint"]),
  text: z.string().min(1).max(400),
});
export type Hint = z.infer<typeof hintSchema>;

// ---------------------------------------------------------------------------
// Projects (spec section 14) — Team-Lead-style project workflow
// ---------------------------------------------------------------------------

export const projectTaskPlanSchema = z.object({
  taskCode: z.string().min(1).max(20), // e.g. "FE-142"
  title: z.string().min(1).max(120),
  requirements: z.array(z.string().min(1).max(200)).min(2).max(10),
});

export const projectFileSchema = z.object({
  filename: z.string().min(1).max(60),
  language: programmingLanguageSchema,
  // Deliberately no starter/skeleton content — the learner writes every
  // file from a blank slate starting with task 1. Gemini only decides the
  // file manifest (which files the project needs), never any of their
  // content, so nothing hints at structure or implementation up front.
});

export const projectPlanSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(800),
  // The file manifest for the WHOLE project (not per-task) — a "JS Kanban
  // board" genuinely needs index.html + styles.css + script.js, while a
  // pure algorithms project might need just one file. Decided once here so
  // the codebase is consistent as tasks build on each other.
  files: z.array(projectFileSchema).min(1).max(6),
  tasks: z.array(projectTaskPlanSchema).min(2).max(8),
});
export type ProjectPlan = z.infer<typeof projectPlanSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;

// Short project "pitches" offered before committing to a full plan — see
// buildProjectIdeasPrompt. Deliberately much lighter than projectPlanSchema
// (no files/tasks) so browsing options is cheap; the full plan is only
// generated once the learner picks one (or writes their own topic).
export const projectIdeaSchema = z.object({
  // Seed topic re-used as the `topic` input to the existing full-plan
  // generation flow if this idea is picked — same shape as a hand-typed topic.
  topic: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
});
export const projectIdeasSchema = z.object({
  ideas: z.array(projectIdeaSchema).min(4).max(5),
});
export type ProjectIdea = z.infer<typeof projectIdeaSchema>;

// ---------------------------------------------------------------------------
// Translation bundles — see convex/translations.ts for the cache these back.
// Each bundle mirrors exactly the fields that get displayed for its source
// (learningPaths+topics, or projects+projectTasks), translated together in
// ONE Gemini call rather than per-row, since a whole path/project is always
// viewed together. Stable ids (externalId / taskCode) round-trip so the
// translated array can be zipped back onto the original rows by key rather
// than by array position (which Gemini isn't guaranteed to preserve).
// ---------------------------------------------------------------------------

export const translatedLearningPathSchema = z.object({
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(800),
  knowledgeProfileSummary: z.string().max(600).nullable(),
  topics: z
    .array(
      z.object({
        externalId: z.string().min(1),
        title: z.string().min(1).max(120),
        summary: z.string().min(1).max(800),
      })
    )
    .min(1),
});
export type TranslatedLearningPath = z.infer<typeof translatedLearningPathSchema>;

export const translatedProjectSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(800),
  tasks: z
    .array(
      z.object({
        taskCode: z.string().min(1),
        title: z.string().min(1).max(120),
        requirements: z.array(z.string().min(1).max(200)).min(1).max(10),
      })
    )
    .min(1),
});
export type TranslatedProject = z.infer<typeof translatedProjectSchema>;

// Exercises and mistakes are freely-mixed lists (the practice board pulls
// from several topics at once; the mistakes list spans a learner's whole
// history) rather than a single always-viewed-together parent, so each
// bundle here is keyed per-row (by exercise/mistake _id) and translated as
// a batch of independent rows, not as one nested structure like the two
// schemas above.
export const translatedExerciseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  subtopic: z.string().min(1).max(120),
  prompt: z.string().min(1).max(3000),
  choices: z.array(z.string().min(1).max(300)).max(6).nullable(),
});
export type TranslatedExercise = z.infer<typeof translatedExerciseSchema>;

export const translatedExerciseBatchSchema = z.object({
  exercises: z.array(translatedExerciseSchema).min(1),
});

export const translatedMistakeSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(400),
});
export type TranslatedMistake = z.infer<typeof translatedMistakeSchema>;

export const translatedMistakeBatchSchema = z.object({
  mistakes: z.array(translatedMistakeSchema).min(1),
});

export const reviewCommentSchema = z.object({
  severity: z.enum(["blocking", "suggestion", "nit"]),
  comment: z.string().min(1).max(400),
});

export const reviewSchema = z.object({
  verdict: z.enum(["approved", "changes_requested"]),
  summary: z.string().min(1).max(500),
  comments: z.array(reviewCommentSchema).max(15),
});
export type Review = z.infer<typeof reviewSchema>;

// ---------------------------------------------------------------------------
// Concept / theory block (spec section 6: "Quick concept" + "Example")
// ---------------------------------------------------------------------------

export const conceptExampleSchema = z.object({
  code: z.string().min(1).max(2000),
  explanation: z.string().min(1).max(500),
});

// One step of a beginner's guided lesson. Kept small (a heading, a short body,
// at most one tiny example) so a lesson reads as a sequence of bite-sized
// pages rather than the "wall of text" spec section 6 warns against.
// A one-question, ungraded self-check on a section. If the model produces a
// malformed one (e.g. correctIndex past the last choice) it's dropped to null
// rather than failing the whole lesson - the check is a bonus, not the lesson.
export const conceptCheckSchema = z
  .object({
    question: z.string().min(1).max(300),
    choices: z.array(z.string().min(1).max(200)).min(2).max(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(1).max(400),
  })
  .refine((c) => c.correctIndex < c.choices.length);
export type ConceptCheck = z.infer<typeof conceptCheckSchema>;

export const conceptSectionSchema = z.object({
  heading: z.string().min(1).max(100),
  body: z.string().min(1).max(1000),
  example: looseNullable(conceptExampleSchema),
  check: conceptCheckSchema
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
});
export type ConceptSection = z.infer<typeof conceptSectionSchema>;

export const conceptSchema = z.object({
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  // Deliberately short — spec section 6 explicitly warns against "walls of text".
  // For a beginner's lesson this is the opening ("what is this and why care"),
  // with the step-by-step teaching in `sections`.
  explanation: z.string().min(1).max(1200),
  keyPoints: z.array(z.string().min(1).max(200)).min(2).max(6),
  example: looseNullable(conceptExampleSchema),
  // Which language the code examples are written in, for syntax highlighting
  // (an HTML/CSS lesson shouldn't be colored as JavaScript). Absent on
  // concepts cached before this field existed.
  language: programmingLanguageSchema.nullish(),
  // The beginner lesson. Empty/absent for everyone else (the quick concept
  // above is the whole thing), and absent on concepts cached before this
  // field existed - hence optional rather than defaulted.
  sections: z.array(conceptSectionSchema).max(8).optional(),
});
export type Concept = z.infer<typeof conceptSchema>;
