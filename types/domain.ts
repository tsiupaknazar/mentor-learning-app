/**
 * Domain types for the learning platform. These are the TypeScript-side
 * mirrors of the Zod schemas in `lib/schemas.ts` — Zod is the source of
 * truth for anything that crosses an AI or network boundary; these types
 * are inferred from those schemas wherever possible (see schemas.ts).
 */

export type SkillLevel = "beginner" | "junior" | "intermediate" | "advanced";

export type ProgrammingLanguage = "javascript" | "typescript" | "html" | "css" | "python" | "sql";

export type LearningGoal =
  | "first_job"
  | "interview_prep"
  | "improve_skills"
  | "learn_new_tech"
  | "production_skills"
  | "master_topic";

export type LearningStyle = "more_practice" | "balanced" | "more_theory";

export type DailyTime = "15min" | "30min" | "1hr" | "2hr_plus";

export type MasteryBand = "weak" | "medium" | "strong";

export type ExerciseType =
  | "multiple_choice"
  | "code_prediction"
  | "code_completion"
  | "debugging"
  | "refactoring"
  | "implementation"
  | "architecture_decision"
  | "explain_code"
  | "find_the_bug"
  | "compare_implementations"
  | "optimize_code"
  | "write_tests"
  | "review_code";

export type ExerciseDifficulty = "easy" | "medium" | "hard" | "interview" | "real_world";

export type DiagnosticQuestionType =
  | "knowledge"
  | "code_reading"
  | "debugging"
  | "implementation"
  | "explanation";

/**
 * The compact context sent to Gemini on every request. Deliberately does
 * NOT include full history — only what the model needs to make the next
 * decision. See `lib/learner-context.ts` for how this is assembled and
 * `AI_ARCHITECTURE.md` for the cost-control rationale.
 */
/** UI + AI-generated content language. */
export type Locale = "en" | "uk";

export interface LearnerContext {
  level: SkillLevel;
  learningGoal: LearningGoal;
  learningStyle: LearningStyle;
  locale: Locale;
  currentTopics: string[];
  weakTopics: string[];
  strongTopics: string[];
  recurringMistakes: string[];
  recentPerformance: number; // 0-100, rolling average of recent attempt scores
  // The active learning path's own top-level subject (e.g. "HTML/CSS"),
  // null if the learner has no active path. See lib/topic-language.ts's
  // resolveProjectLanguageScope.
  pathSubject: string | null;
}

/** What the exercise-generation API actually sends the browser — the answer key is stripped server-side. */
export interface ClientExercise {
  id: string;
  topic: string;
  subtopic: string;
  type: ExerciseType;
  difficulty: ExerciseDifficulty;
  language: ProgrammingLanguage;
  title: string;
  prompt: string;
  starterCode: string | null;
  choices: string[] | null;
  testCases: Array<{ input: string; expectedOutput: string; description: string | null }> | null;
  // The locale this exercise's title/subtopic/prompt/choices were
  // actually generated in — see convex/schema.ts's exercises.contentLocale
  // comment. Undefined for exercises created before this field existed.
  contentLocale?: Locale;
}

export interface MasteryScore {
  knowledge: number;
  application: number;
  debugging: number;
  explanation: number;
  retention: number;
  overall: number;
}
