import type { Exercise, KnowledgeProfile } from "@/lib/schemas";
import type { ConceptDepth, LearnerContext, LearningStyle, Locale, SkillLevel } from "@/types/domain";
import type { ScaffoldStep } from "@/lib/scaffolding";
import type { TestResult } from "@/lib/js-tests";
import { resolveProjectLanguageScope } from "@/lib/topic-language";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  uk: "Ukrainian",
};

/**
 * Appended to every system prompt that produces learner-facing text.
 * English needs no instruction (it's the model's default and the
 * schemas/examples above are already written in English). For any other
 * locale, every prose field must come back in that language while code
 * itself stays idiomatic — translating identifiers/keywords would produce
 * code that doesn't actually run or doesn't match real-world conventions.
 */
function languageInstruction(locale: Locale): string {
  if (locale === "en") return "";
  const name = LANGUAGE_NAMES[locale];
  return `\n\nLANGUAGE: Write every learner-facing string in this response in ${name} — titles, prompts, explanations, hints, feedback, summaries, choices, everything a human reads. Code comments should also be in ${name}. Do NOT translate: JSON field/key names, code itself (keywords, variable/function names stay in English/the programming language as normal, per real-world convention), programming-language names, or filenames (e.g. "index.html", "styles.css" stay as-is). Never mix languages within one field.`;
}

function formatLearnerContext(ctx: LearnerContext): string {
  return JSON.stringify(
    {
      level: ctx.level,
      learningGoal: ctx.learningGoal,
      learningStyle: ctx.learningStyle,
      currentTopics: ctx.currentTopics,
      weakTopics: ctx.weakTopics,
      strongTopics: ctx.strongTopics,
      recurringMistakes: ctx.recurringMistakes,
      recentPerformance: ctx.recentPerformance,
      pathSubject: ctx.pathSubject,
    },
    null,
    0
  );
}

/**
 * The persona injected into every evaluation / hint / mentor system prompt.
 * This is what keeps Gemini from drifting into generic chatbot encouragement
 * (spec section 10 "Strict Mentor Mode", section 27 "AI Feedback Format").
 */
export const MENTOR_PERSONA = `You are a demanding Senior Developer / Team Lead reviewing a learner's work.

Rules you always follow:
- Never give unearned praise. "Great job!" and similar generic encouragement are forbidden.
- Distinguish explicitly between "correct but poorly implemented" and "incorrect". Working code is not automatically a high score.
- Do not reveal a complete solution unless the caller explicitly signals the learner exhausted hints or asked for the solution.
- If the learner's justification for a choice is vague ("it was easier", "it just works"), push back and ask them to be specific (time complexity? readability? runtime?).
- Identify the single most important problem first. Do not list every possible nitpick.
- Keep feedback concrete and tied to the learner's actual code/answer, never generic advice that could apply to anything.
- Your goal is to build engineering judgment, not just to mark answers right or wrong.`;

/**
 * Appended to the mentor persona for an absolute beginner. The persona's
 * honesty stays (no false praise, correct-but-poor is still called out); what
 * changes is the delivery and what is held against someone in their first
 * hours of coding.
 */
export const BEGINNER_MENTOR_ADDENDUM = `This learner is an ABSOLUTE BEGINNER, so adapt the delivery, not the honesty: if anything they did is right, say exactly what first (specific, never generic praise); then give the single most important issue in plain words, without jargon; never judge best practices, style or edge cases the exercise didn't ask for - score those fields in line with correctness rather than below it; and do not demand that they justify design choices. Any follow-up question must be a simple, concrete one they can answer by looking at their own code, or null.`;

const mentorPersonaFor = (level: SkillLevel | undefined) =>
  level === "beginner" ? `${MENTOR_PERSONA}\n\n${BEGINNER_MENTOR_ADDENDUM}` : MENTOR_PERSONA;

// ---------------------------------------------------------------------------
// Diagnostic assessment
// ---------------------------------------------------------------------------

export function buildDiagnosticPrompt(topic: string, selfReportedLevel: string, locale: Locale = "en") {
  return {
    system: `You design diagnostic assessments for a programming learning platform. Mix question types (knowledge, code_reading, debugging, implementation, explanation) — never all multiple choice. Questions must actually discriminate between skill levels, not just test memorized trivia. A shallow 5-question quiz cannot responsibly place someone across a broad topic — you decide how many questions and how many distinct subtopics are needed based on how broad the topic actually is, and you err toward more coverage rather than less. Return ONLY JSON matching the required schema.${languageInstruction(locale)}`,
    prompt: `Topic: ${topic}
Learner's self-reported level: ${selfReportedLevel} (they may be wrong — that's why we're testing).

Step 1 (internal, do not include in output): list the core subtopics someone would need to know to be considered competent in "${topic}". For a broad subject (a whole language, framework, or discipline — e.g. "JavaScript", "React", "SQL") that's typically 8-12 subtopics. For a narrow or custom topic (e.g. "React Server Components", "SQL window functions") that's typically 4-6 subtopics.

Step 2: write questions so EVERY one of those subtopics gets at least one question, and any subtopic central to the topic gets two questions of different types (e.g. one knowledge question and one debugging question) so a lucky or unlucky single guess can't swing that subtopic's rating. This means the total question count should usually land in the 10-16 range for a broad topic, or 6-10 for a narrow one — do not artificially shrink coverage to save space.

${selfReportedLevel === "not_sure" ? `The learner does not know their level and may never have written code, so order the questions from very gentle to demanding: open with two or three that anyone who has read an introduction could answer (what something is, what a short snippet prints), keep the debugging and implementation questions for the later, harder part and small in scope, and never make the first question a coding task. ` : ""}Include at least two debugging questions (show broken code) and at least two implementation questions across the set. For multiple_choice questions, populate "choices"; otherwise set choices to null. Set codeSnippet to null unless the question shows code. Each question needs a stable id (e.g. "q1") and its actual "subtopic" from your step-1 list.`,
  };
}

export function buildKnowledgeProfilePrompt(
  topic: string,
  answeredQuestions: Array<{ prompt: string; type: string; subtopic: string; answer: string }>,
  locale: Locale = "en"
) {
  return {
    system: `You evaluate a completed programming diagnostic and produce a knowledge profile. Judge correctness, reasoning, terminology, and evidence of real understanding vs. memorization — not just whether the final answer matches a keyword. Return ONLY JSON matching the required schema.${languageInstruction(locale)}`,
    prompt: `Topic: ${topic}

Learner's answers:
${JSON.stringify(answeredQuestions, null, 2)}

For each distinct subtopic represented above, assign a mastery band (weak/medium/strong) with a one-sentence rationale grounded in what the learner actually wrote. Then suggest an overall skill level (beginner/junior/intermediate/advanced) and a short summary of where they stand.`,
  };
}

// ---------------------------------------------------------------------------
// Learning path
// ---------------------------------------------------------------------------

export function buildLearningPathPrompt(
  ctx: LearnerContext,
  topic: string,
  knowledgeProfile: KnowledgeProfile | null
) {
  return {
    system: `You design structured, dependency-ordered learning paths for a practice-first programming curriculum (learn -> try -> fail -> feedback -> fix -> apply -> increase difficulty). Paths should skip or compress topics the learner has already demonstrated strength in, and expand topics they're weak in. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}
Requested topic: ${topic}
Knowledge profile from diagnostic: ${knowledgeProfile ? JSON.stringify(knowledgeProfile) : "none — no diagnostic was taken, assume the learner's self-reported level is accurate"}

${ctx.level === "beginner" ? `The learner is an ABSOLUTE BEGINNER: make the first topic assume nothing, order topics in the smallest steps that each build on the last (one new idea per topic, teachable and practised in a single short session), never start from an advanced or tool-heavy topic, and only include topics a beginner can do in a browser with no setup. ` : ""}Generate a learning path for "${topic}" as a tree of topics (max depth 3, max 12 top-level topics). Each topic needs a short id, title, one-sentence summary, prerequisiteIds referencing earlier topic ids in this same tree (empty array if none), and nested children where useful. Weight time toward ${ctx.weakTopics.length > 0 ? `weak areas: ${ctx.weakTopics.join(", ")}` : "foundational concepts, since no weak areas are known yet"}.`,
  };
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

/**
 * Generates a batch of standalone practice problems for the Codewars/LeetCode-
 * style Practice board — spread across the given topics and across
 * easy/medium/hard, all in one call rather than one exercise at a time.
 */
export function buildPracticeProblemSetPrompt(
  ctx: LearnerContext,
  topics: Array<{ title: string; language: string | null }>,
  perTopicCounts: { easy: number; medium: number; hard: number },
  avoidTitles: string[]
) {
  const total = topics.length * (perTopicCounts.easy + perTopicCounts.medium + perTopicCounts.hard);
  const topicLines = topics
    .map((t) => (t.language ? `- "${t.title}" — language MUST be "${t.language}"` : `- "${t.title}" — pick whichever language genuinely fits each problem`))
    .join("\n");
  return {
    system: `You generate a batch of standalone practice problems for a programming platform, styled like a LeetCode/Codewars problem list — each one is self-contained (no shared setup between problems) and browsable before being attempted. Difficulty must be genuinely calibrated: "easy" solvable in a few minutes, "medium" requires real thought, "hard" is genuinely challenging for the learner's level. Provide a correct, complete reference solution for each, even though the learner never sees it directly. When a topic states a required language below, every single problem for that topic MUST use exactly that language — this is not a suggestion, do not substitute a different language even if it feels like a more natural fit for the problem you thought of. Any code you write (starterCode, referenceSolution) must be properly formatted, human-readable source — real line breaks and consistent indentation, never a single flattened line. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}
Topics to generate problems for (use each topic name in the "topic" field EXACTLY as written here, verbatim, so problems can be matched back to their topic):
${topicLines}
For EACH topic above, generate exactly ${perTopicCounts.easy} easy, ${perTopicCounts.medium} medium, and ${perTopicCounts.hard} hard problems (${total} problems total across all topics).
Problems already generated recently (do not repeat these, generate distinct problems): ${avoidTitles.length ? avoidTitles.join(", ") : "none"}

Pick whichever exercise type (multiple_choice, code_prediction, code_completion, debugging, refactoring, implementation, explain_code, find_the_bug, compare_implementations, optimize_code, write_tests, review_code) best fits each problem — vary it across the set, don't default to implementation every time. Give each a stable id and a short, punchy, LeetCode-style title (e.g. "Two Sum", "Debounce a Function") rather than a generic label. ${levelGuidance(ctx.level) ? `${levelGuidance(ctx.level)} ` : ""}${exerciseStyleGuidance(ctx.learningStyle) ? `${exerciseStyleGuidance(ctx.learningStyle)} Still vary the types across the set. ` : ""}Set "difficulty" to exactly "easy", "medium", or "hard" for every problem — never use "interview" or "real_world" here. Set "language" per the requirement stated for each topic above. If it's a coding problem, include starterCode and testCases; otherwise set those to null. Always include a complete referenceSolution. ${TEST_CASE_RULE} ${PREVIEW_MARKUP_RULE}`,
  };
}

/**
 * CSS on its own has nothing to render, so a CSS exercise ships the markup its
 * styles apply to and the app previews the learner's CSS against it.
 */
/**
 * Test cases the app can actually run (lib/js-tests.ts) need a fixed shape;
 * free-form ones can't be executed, so JavaScript exercises are asked for it.
 */
const TEST_CASE_RULE = `For a javascript exercise whose answer is a function, write each test case's "input" as a single JavaScript expression that calls that function (for example "sum(2, 3)") and its "expectedOutput" as the JSON of the value it should return (for example "5", "[1,2]" or "\\"abc\\""); avoid tests that depend on console output, randomness or time.`;

const PREVIEW_MARKUP_RULE = `Set "previewMarkup" to a small, self-contained HTML fragment (at most about 25 lines, no <style> and no scripts) that the learner's CSS is meant to style when the language is "css" - the starterCode is then only CSS and the exercise prompt should say what the markup contains; for every other language set "previewMarkup" to null.`;

/**
 * Nudges which exercise types get picked, from the learner's stated style.
 * "balanced" is no nudge at all - the model's own variety is the balance.
 */
export function exerciseStyleGuidance(style: LearningStyle): string {
  if (style === "more_theory") {
    return "The learner prefers understanding over drilling: lean toward exercises that test reasoning about code (multiple_choice, code_prediction, explain_code, find_the_bug, compare_implementations, architecture_decision) and that ask them to explain why, over exercises where they mostly write code.";
  }
  if (style === "more_practice") {
    return "The learner prefers hands-on practice: lean toward exercises where they write or edit real code (implementation, code_completion, debugging, refactoring, optimize_code, write_tests) over exercises that only ask them to read and explain.";
  }
  return "";
}

/**
 * What a beginner can be asked. The full menu includes types (architecture
 * decisions, code review, comparing implementations) that assume experience,
 * and "easy" means nothing until it's pinned to what a beginner has just learned.
 */
export function levelGuidance(level: SkillLevel): string {
  if (level !== "beginner") return "";
  return `This learner is an ABSOLUTE BEGINNER, so use only exercise types a beginner can do: multiple_choice, code_prediction, code_completion, find_the_bug, explain_code (a few lines), debugging (one obvious bug) or a very small implementation - never architecture_decision, compare_implementations, optimize_code, write_tests, review_code or refactoring. Test one idea. Keep any code under about 15 lines, use plain wording, and explain any term the exercise itself needs. "easy" means easy for someone who finished the lesson a few minutes ago.`;
}

/**
 * Faded worked examples for a beginner's first exercises on a topic: a fully
 * worked example with one blank, then a skeleton with a few, then normal
 * exercises. Support is withdrawn gradually so the first exercise isn't a
 * blank page.
 */
function scaffoldingGuidance(step: ScaffoldStep | null): string {
  if (step === 0) {
    return `SCAFFOLDING - this is the learner's very first exercise on this topic and they are a beginner, so make it a worked example to finish, not a blank page. Use exercise type "code_completion" when this subtopic involves writing code (otherwise "multiple_choice" or "code_prediction"). The starterCode must be a complete, working, well-commented example of a closely related tiny task with exactly ONE clearly marked blank ("____") for the learner to fill in, and the prompt must say what the example does and which part to complete. Keep it easy.`;
  }
  if (step === 1) {
    return `SCAFFOLDING - this is the learner's second exercise on this topic and they are a beginner, so fade the support. Use exercise type "code_completion". The starterCode gives the overall structure with a comment saying what each part should do, but leaves two or three parts blank ("____") for the learner to write. Do not include a worked solution to a related task this time.`;
  }
  return "";
}

export function buildExercisePrompt(
  ctx: LearnerContext,
  topic: string,
  subtopic: string,
  difficulty: string,
  avoidExerciseTitles: string[],
  requiredLanguage: string | null,
  scaffold: ScaffoldStep | null = null
) {
  const guidance = [levelGuidance(ctx.level), exerciseStyleGuidance(ctx.learningStyle), scaffoldingGuidance(scaffold)]
    .filter(Boolean)
    .join("\n");
  const languageLine = requiredLanguage
    ? `Language MUST be "${requiredLanguage}" — this topic names that language explicitly, it is not a judgment call.`
    : `Pick whichever of javascript/typescript/html/css/python/sql the subtopic is actually written in — a CSS layout topic should produce CSS, a SQL topic should produce SQL, and so on.`;
  return {
    system: `You generate individual practice exercises for a programming learning platform. Difficulty must match the requested level precisely — do not soften or inflate it. Provide a correct, complete reference solution the grader can use, even though the learner never sees it directly. When the topic names a required language, every exercise for it MUST use exactly that language — this is not a suggestion, do not substitute a different language even if a different one feels like a more natural fit for the exercise you thought of. Any code you write (starterCode, referenceSolution) must be properly formatted, human-readable source — real line breaks and consistent indentation, never a single flattened line. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}
Topic: ${topic}
Subtopic: ${subtopic}
Target difficulty: ${difficulty}
Exercises the learner has already seen recently (do not repeat these, generate something distinct): ${avoidExerciseTitles.length ? avoidExerciseTitles.join(", ") : "none"}

Generate one exercise. Pick whichever exercise type (multiple_choice, code_prediction, code_completion, debugging, refactoring, implementation, architecture_decision, explain_code, find_the_bug, compare_implementations, optimize_code, write_tests, review_code) best fits this subtopic and difficulty — vary it, don't default to implementation every time. Give it a stable id. ${languageLine} If it's a coding exercise, include starterCode and testCases; otherwise set those to null. Always include a complete referenceSolution (even for non-coding types, describe the ideal answer there). ${TEST_CASE_RULE} ${PREVIEW_MARKUP_RULE}${guidance ? `\n\n${guidance}` : ""}

HARD CONSTRAINT: this exercise must test ONLY "${subtopic}" itself, regardless of difficulty. Do not pull in concepts, APIs, or techniques that belong to a different topic in the learner's path — especially a more advanced one they haven't reached yet, since the learner may not have unlocked it. Raise difficulty by testing "${subtopic}" more rigorously (deeper edge cases, subtler bugs, less hand-holding, higher ambiguity), never by importing material from outside it.`,
  };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export function buildEvaluationPrompt(
  ctx: LearnerContext,
  exercise: Exercise,
  userAnswer: string,
  lessonSections: string[] = [],
  testResults: TestResult[] = []
) {
  const testLine = testResults.length
    ? `\nThe learner's code was run against the exercise's test cases in their browser (client-reported, so weigh it as strong evidence but still read the code): ${JSON.stringify(testResults.map((r) => ({ call: r.input, expected: r.expected, got: r.actual, passed: r.passed, error: r.error })))}. ${testResults.every((r) => r.passed) ? "Every case passed: do not mark the answer incorrect unless you can point to a specific way the code is still wrong for the exercise." : "Some cases failed: name which case fails and why, rather than a generic complaint."}\n`
    : "";
  const lessonLine = lessonSections.length
    ? `The learner was just taught these lesson sections on this topic: ${JSON.stringify(lessonSections)}. If their mistake shows they misunderstood something one of those sections covers, set "relatedLessonSection" to that section's heading EXACTLY as written above; otherwise (including for a correct answer) set it to null.`
    : `Set "relatedLessonSection" to null.`;
  return {
    system: `${mentorPersonaFor(ctx.level)}\n\nYou are reviewing a submitted answer against a specific exercise. Return ONLY JSON matching the required schema — the "whatYouDid", "problem", "whyItMatters", "hint", and "nextStep" fields map directly to a structured feedback panel the learner will read, so write each as a short, direct statement (1-3 sentences), never a wall of text.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}

Exercise:
${JSON.stringify({ title: exercise.title, prompt: exercise.prompt, type: exercise.type, difficulty: exercise.difficulty, testCases: exercise.testCases }, null, 2)}

Reference solution (for grading only, learner never sees this verbatim):
${exercise.referenceSolution}

Learner's submitted answer:
${userAnswer}
${testLine}
Evaluate correctness, logic, code quality, best practices, and edge case handling (0-100 each). Set "result" to correct/partially_correct/incorrect. If the answer is correct but poorly implemented, "result" should still reflect that nuance in the scores (e.g. correctness high, codeQuality low) — do not inflate the overall read of quality just because it runs. If a specific misconception is evident (not just a typo), name it in "detectedMisconception" (in the learner's language) AND give "detectedMisconceptionKey": a short, stable identifier for it in English, kebab-case, 2-5 words (e.g. "off-by-one-loop-bound", "missing-await", "mutating-state-directly") — this is what the app uses to recognize the SAME misconception recurring later even if the learner's display language changes, so keep it consistent and specific to the actual error, not generic. Otherwise set both to null. If the learner's stated reasoning is vague or unjustified, add a direct challenging question in "mentorFollowUp" (e.g. asking them to justify a choice) — the learner WILL be able to type a reply to it, so only ask something they can meaningfully answer in a sentence or two, never rhetorical; otherwise null. ${lessonLine}`,
  };
}

/**
 * Reacts to the learner's reply to `mentorFollowUp` — a single bounded
 * continuation of that one exchange (not an open-ended chat). Ungraded:
 * this doesn't touch scores, mastery, or attempts, it's purely the
 * back-and-forth the mentor persona already implies by asking a question
 * in the first place (see the landing page's own review-exchange mock).
 */
export function buildFollowUpReactionPrompt(
  ctx: LearnerContext,
  exercise: Pick<Exercise, "title" | "prompt">,
  followUpQuestion: string,
  learnerResponse: string
) {
  return {
    system: `${mentorPersonaFor(ctx.level)}\n\nYou asked the learner a direct follow-up question about their submitted answer; they've now replied. React briefly — 1-3 sentences, never a wall of text. If their reasoning now holds up, say specifically what's now correct (no generic praise). If it's still vague, wrong, or dodges the question, push back again, sharper and more specific than your original question. Set "resolved" to true only if their reply actually demonstrates understanding, not just if they attempted an answer. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}

Exercise: ${exercise.title}
${exercise.prompt}

Your follow-up question: ${followUpQuestion}
Learner's reply: ${learnerResponse}`,
  };
}

// ---------------------------------------------------------------------------
// Concept / theory block
// ---------------------------------------------------------------------------

/**
 * What a concept prompt may depend on. Deliberately NOT the full learner
 * context: the generated concept is cached and shared between learners
 * (convex/concepts.ts), keyed on exactly these fields, so nothing personal
 * (weak topics, mistakes, performance) can be in the prompt.
 */
export type ConceptContext = Pick<LearnerContext, "level" | "learningStyle" | "locale">;

export function buildConceptPrompt(
  ctx: ConceptContext,
  topic: string,
  subtopic: string,
  depth: ConceptDepth = ctx.level === "beginner" ? "full" : "quick"
) {
  if (depth === "full") return buildBeginnerLessonPrompt(ctx, topic, subtopic);

  const lengthGuidance =
    ctx.learningStyle === "more_theory"
      ? "The learner prefers more theory — you can go slightly deeper, but still stay concise (a paragraph, not an essay)."
      : ctx.learningStyle === "more_practice"
        ? "The learner prefers more practice — keep this genuinely brief; they want to get to exercises quickly."
        : "Keep this concise — a short paragraph, not a lecture.";
  return {
    system: `You write short "quick concept" explanations for a practice-first programming platform. This is NOT a full lesson — it's the minimum context a learner needs before attempting a problem. Never write a wall of text. Prefer one concrete example over multiple abstract ones. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner: ${JSON.stringify({ level: ctx.level, learningStyle: ctx.learningStyle })}
Topic: ${topic}
Subtopic: ${subtopic}

Write a short concept explanation for "${subtopic}" (within "${topic}"). ${lengthGuidance}
Include 2-6 short keyPoints (each one line, not a paragraph) the learner should walk away with.
Include one small, realistic code example with a one-to-two-sentence explanation of what it shows — unless this subtopic genuinely has no meaningful code example (e.g. a purely conceptual/architectural topic), in which case set "example" to null.
Set "language" to the language the example is written in (null when there is no example). Set "sections" to an empty array.`,
  };
}

/**
 * The quick concept assumes the learner already has the surrounding
 * vocabulary, which an absolute beginner doesn't - one short paragraph leaves
 * them with nothing to attempt the exercises with. So for level "beginner"
 * the same call produces a short guided lesson instead: several small
 * sections, each teaching one idea, in the order a good tutor would.
 */
function buildBeginnerLessonPrompt(ctx: ConceptContext, topic: string, subtopic: string) {
  const sectionCount =
    ctx.learningStyle === "more_theory"
      ? "5-6"
      : ctx.learningStyle === "more_practice"
        ? "3-4"
        : "4-5";
  return {
    system: `You are a patient programming tutor teaching an ABSOLUTE BEGINNER who may have never written code, on a platform where they learn by doing. Before their first exercise on a topic you give them a short guided lesson: enough that they can genuinely attempt the exercises, but split into small bite-sized sections, never a wall of text. Assume nothing: the first time you use any technical term, say what it means in plain words. Prefer everyday analogies to jargon. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner: ${JSON.stringify({ level: ctx.level, learningStyle: ctx.learningStyle })}
Topic: ${topic}
Subtopic: ${subtopic}

Write a beginner's lesson on "${subtopic}" (within "${topic}"):
- "explanation": the opening, 2-4 plain sentences on what "${subtopic}" is and why anyone would need it. Use an everyday analogy if one fits.
- "sections": ${sectionCount} short sections, in this order of ideas: the core idea in small pieces; the smallest possible code example, explained step by step; a second example that changes just one thing so the learner sees what it controls; the mistakes beginners most often make with it and how to spot them. Skip any step that doesn't apply to this subtopic, but never pad. Each section has a short "heading" (a plain label or question, not a slogan), a "body" of 2-5 short sentences (about 600 characters at most), and an "example": a tiny code snippet (at most about 8 lines, with a comment on each non-obvious line) plus a one-to-two-sentence explanation of what it shows, or null when the section is purely explanation. Each section also has a "check": one quick multiple-choice question (2-4 short choices, "correctIndex" the zero-based index of the right one, and a one-sentence "explanation" of why) that tests only what THAT section just taught and can be answered from reading it, with a plausible wrong answer built from a real beginner misconception - or null for a section where a question would be forced. Put the correct answer at varying positions. Do not repeat the same idea across sections.
- "keyPoints": 3-6 one-line takeaways that recap the lesson.
- "example": null (the examples live inside the sections).
- "language": the language all the code examples are written in (null when the lesson has none).

HARD CONSTRAINT: teach ONLY "${subtopic}". Do not pull in concepts, syntax, or APIs that belong to other topics, especially more advanced ones the learner hasn't reached yet; if a small example can't avoid something outside this subtopic, use it without explaining it in depth rather than teaching it. Assume nothing else about what the learner knows.`,
  };
}

// ---------------------------------------------------------------------------
// Projects (spec section 14) — Team Lead persona
// ---------------------------------------------------------------------------

export const TEAM_LEAD_PERSONA = `You are a Team Lead assigning and reviewing real engineering work, not a course author. Projects and tasks should feel like tickets from an actual sprint — scoped, specific, with concrete acceptance criteria — not tutorial busywork. Requirements should include the unglamorous parts (accessibility, edge cases, error states) that separate "it works on the happy path" from production-ready.`;

export function buildProjectPlanPrompt(
  ctx: LearnerContext,
  topic: string,
  level: string,
  violation?: { attemptedLanguages: string[]; requiredScope: string[] }
) {
  // Deterministic backstop, not just an instruction Gemini has to infer
  // from the topic string on its own — see resolveProjectLanguageScope's
  // comment for why the soft "e.g. HTML/CSS" guidance below wasn't enough
  // on its own (a freeform idea topic like "Contact form with validation"
  // never says HTML/CSS even when that's genuinely all it should need).
  const scope = resolveProjectLanguageScope(topic, ctx.pathSubject);
  const scopeLine = scope
    ? `\n\nREQUIRED SCOPE (not an example — this is the actual constraint for this project): "${topic}" is a markup/styling-only subject. Every file's language MUST be one of: ${scope.join(", ")}. Do not include javascript/typescript files, a backend, a database, or any external API — not even one small helper script. If the project idea seems to need one of those, redesign it as a pure ${scope.join("/")} version instead (e.g. a form that shows inline validation states without actually submitting anywhere), don't reach outside this scope.`
    : "";
  const violationLine = violation
    ? `\n\nCORRECTION REQUIRED: your previous attempt at this same project used file language(s) [${violation.attemptedLanguages.join(", ")}], which violates the required scope of [${violation.requiredScope.join(", ")}] above. Redesign the project so every file genuinely only needs ${violation.requiredScope.join("/")} — remove or rework any part of the idea that assumed a backend, API, or script language, do not just relabel the same file's language.`
    : "";
  return {
    system: `${TEAM_LEAD_PERSONA} Tasks should build on each other in a sensible order. Decide the project's file manifest honestly based on what the topic actually needs — a UI-facing topic (e.g. "JS Kanban board", "React todo app") realistically needs separate HTML/CSS/JS(/TS) files, not everything crammed into one script; a backend-only or pure-algorithms topic may genuinely need just one file. Do not default to a single JS file out of habit. You are deciding the file manifest ONLY — never write any code or file content; the learner writes every file from scratch starting with the first task. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}
Topic: ${topic}
Target level: ${level}

Design one project for a ${level} learner working on "${topic}". It should be the kind of thing that's genuinely useful to have built (not a toy exercise) and appropriately scoped for that level — a beginner project might be "a searchable user list", an intermediate one "an authentication dashboard", an advanced one "a production-style data management app" (these are examples of scope, not topics to copy literally).

HARD CONSTRAINT: the tools and concepts the project actually requires must not exceed what "${topic}" itself covers, no matter how high the target level is. Level controls how polished/thorough the work is WITHIN that topic's tools, not which tools get pulled in. A markup/styling-only topic (e.g. "HTML/CSS") must stay pure client-side HTML/CSS — no JavaScript, no backend, no databases, no real-time sync (WebSockets), no external APIs — an "advanced" version of that project is a more ambitious layout/responsiveness/accessibility challenge, not a project that quietly requires a language or architecture the topic never taught. Only reach for backend, real-time, or data-layer complexity when the topic itself is actually about that (e.g. "Node.js REST APIs", "WebSocket basics").${scopeLine}

Decide the file manifest for the WHOLE project (1-6 files) — e.g. a browser UI project typically needs index.html, styles.css, and script.js (or .ts) as separate files; a Node/CLI/algorithms project might need just one file. Give each file just a real filename and its language — no content. Files start completely empty; the first task's requirements are what tell the learner what to build there.

Break it into 3-6 tasks in a sensible build order (e.g. HTML structure before CSS that styles it, before JS that adds behavior). Give each task a short ticket-style code (e.g. "FE-101", incrementing) and 2-6 specific, testable requirements (e.g. "closes on Escape key", "focus returns to the trigger element on close" — not vague goals like "make it accessible" or "make it good").${violationLine}`,
  };
}

export function buildProjectIdeasPrompt(ctx: LearnerContext, level: string) {
  const hasPath = ctx.currentTopics.length > 0 || ctx.strongTopics.length > 0;
  // Same deterministic backstop as buildProjectPlanPrompt — resolved from
  // the learner's active path subject, since idea generation happens
  // before any specific project topic exists yet.
  const scope = resolveProjectLanguageScope(ctx.pathSubject ?? "", ctx.pathSubject);
  const scopeLine = scope
    ? `\n\nREQUIRED SCOPE (not an example — this is the actual constraint for this learner): their active path is "${ctx.pathSubject}", a markup/styling-only subject. Every idea's "topic" must stay within ${scope.join("/")} only — no JavaScript, no backend, no database, no external API in any of the five ideas, even as a small addition. State the scope limitation plainly in each idea's own "topic" label (e.g. "Responsive photo gallery (HTML/CSS only)") so it carries through if this idea is picked and expanded into a full project plan later.`
    : "";
  return {
    system: `${TEAM_LEAD_PERSONA} Right now you are pitching project options, not building one — each idea is a one-or-two-sentence pitch (title + description), not a spec. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}
Target level: ${level}

Pitch exactly 5 distinct project ideas this learner could build next.${
      hasPath
        ? " Ground each idea in a topic from their current learning path above — prefer currentTopics and strongTopics over weakTopics, since this is a chance to apply what they've been learning, not remediate a weak spot. Pick a genuinely different topic from that path for each of the 5 ideas where possible."
        : " They don't have an established learning path yet, so pick 5 solid, well-rounded topics appropriate for their level instead."
    }

HARD CONSTRAINT: each idea's required tools/concepts must not exceed what its own "topic" actually covers, regardless of the target level — level should raise ambition WITHIN the topic's own tools, never pull in tools the topic never taught. If a topic is markup/styling-only (e.g. "HTML/CSS"), the idea must be buildable as pure client-side HTML/CSS — no JavaScript, no backend, no real-time sync (WebSockets), no databases, no external APIs. Only pitch backend, real-time, or data-layer ideas for topics that are genuinely about that (e.g. "Node.js REST APIs"). Vary the five ideas in shape as much as the learner's ACTUAL topics honestly allow — do not force one toward "backend/API-flavored" if nothing in their path supports that; five solid ideas within-scope beat one that reaches beyond what they know.${scopeLine}

For each idea give:
- "topic": a short topic label (e.g. "React state management", "Node.js REST APIs") — this seeds the full project plan if the learner picks this idea, so keep it specific enough to generate from, not a vague theme.
- "title": a punchy, concrete project title (e.g. "Kanban board with drag-and-drop"), not a restatement of the topic.
- "description": one or two sentences pitching what it is and why it's worth building.`,
  };
}

// ---------------------------------------------------------------------------
// Translation — see convex/translations.ts + lib/schemas.ts's
// translatedLearningPathSchema/translatedProjectSchema for why these
// translate a whole path/project in one call instead of per-field.
// ---------------------------------------------------------------------------

const TRANSLATION_RULES =
  "Translate faithfully — do not summarize, shorten, expand, or add anything not in the source. Preserve exact meaning and tone. Do NOT translate: code identifiers, technology/framework/language names (e.g. \"React\", \"CSS Flexbox\", \"JavaScript\" stay as-is), filenames, or the id fields used to match entries back to their source rows (externalId, taskCode) — copy those through completely unchanged. Return the exact same number of array entries as the source, one-for-one, each keyed by its unchanged id field.";

export function buildLearningPathTranslationPrompt(
  bundle: { title: string; rationale: string; knowledgeProfileSummary: string | null; topics: Array<{ externalId: string; title: string; summary: string }> },
  targetLocale: Locale
) {
  return {
    system: `You translate programming-education content for a learning platform. ${TRANSLATION_RULES} Return ONLY JSON matching the required schema.${languageInstruction(targetLocale)}`,
    prompt: `Translate this learning path (title, rationale, optional summary, and its list of topics) into ${LANGUAGE_NAMES[targetLocale]}:\n\n${JSON.stringify(bundle, null, 2)}`,
  };
}

export function buildProjectTranslationPrompt(
  bundle: { title: string; description: string; tasks: Array<{ taskCode: string; title: string; requirements: string[] }> },
  targetLocale: Locale
) {
  return {
    system: `You translate programming-project content for a learning platform. ${TRANSLATION_RULES} Return ONLY JSON matching the required schema.${languageInstruction(targetLocale)}`,
    prompt: `Translate this project (title, description, and its list of tasks with their requirements) into ${LANGUAGE_NAMES[targetLocale]}:\n\n${JSON.stringify(bundle, null, 2)}`,
  };
}

/**
 * Batched, unlike the two bundle translations above — exercises and
 * mistakes are freely-mixed lists spanning many topics/sessions, not a
 * single parent always viewed together. Each entry's `id` (the exercise
 * or mistake _id) must round-trip unchanged so the response can be zipped
 * back onto the right row regardless of array order.
 */
export function buildExerciseTranslationPrompt(
  bundle: Array<{ id: string; title: string; subtopic: string; prompt: string; choices: string[] | null }>,
  targetLocale: Locale
) {
  return {
    system: `You translate programming-practice exercises for a learning platform. ${TRANSLATION_RULES} Return ONLY JSON matching the required schema.${languageInstruction(targetLocale)}`,
    prompt: `Translate each of these exercises (title, subtopic, prompt, and optional multiple-choice options) into ${LANGUAGE_NAMES[targetLocale]}:\n\n${JSON.stringify(bundle, null, 2)}`,
  };
}

export function buildMistakeTranslationPrompt(
  bundle: Array<{ id: string; description: string }>,
  targetLocale: Locale
) {
  return {
    system: `You translate short programming-misconception descriptions for a learning platform. ${TRANSLATION_RULES} Return ONLY JSON matching the required schema.${languageInstruction(targetLocale)}`,
    prompt: `Translate each of these misconception descriptions into ${LANGUAGE_NAMES[targetLocale]}:\n\n${JSON.stringify(bundle, null, 2)}`,
  };
}

export function buildCodeReviewPrompt(
  ctx: LearnerContext,
  task: { taskCode: string; title: string; requirements: string[] },
  submittedFiles: Array<{ filename: string; content: string }>,
  previousReview: { summary: string; comments: Array<{ severity: string; comment: string }> } | null
) {
  const filesBlock = submittedFiles
    .map((f) => `--- ${f.filename} ---\n${f.content}`)
    .join("\n\n");
  return {
    system: `${MENTOR_PERSONA}\n\nYou are reviewing a pull request against a specific ticket's requirements, as that learner's Team Lead. "approved" means every requirement is genuinely met at production quality — working code that misses a requirement is "changes_requested", not "approved". Use "blocking" only for things that must change before merge (a missing requirement, a real bug); "suggestion" for things worth doing but not blocking; "nit" for minor style points. When you reference a problem, name the file it's in. Comments should read like real PR review comments tied to something specific in the code, never generic advice. Return ONLY JSON matching the required schema.${languageInstruction(ctx.locale)}`,
    prompt: `Learner context: ${formatLearnerContext(ctx)}

Task ${task.taskCode}: ${task.title}
Requirements:
${task.requirements.map((r) => `- ${r}`).join("\n")}
${
  previousReview
    ? `\nPrevious review on an earlier submission of this same task:\nVerdict: changes_requested\nSummary: ${previousReview.summary}\nComments: ${JSON.stringify(previousReview.comments)}\n\nCheck specifically whether THIS submission actually addresses those previous comments — don't just re-review from scratch as if this were the first attempt.`
    : "This is the first submission for this task."
}

Submitted files:
${filesBlock}

Review it against the requirements above. List comments as an array (empty array is fine if there's truly nothing to flag on an approved submission).`,
  };
}

export function buildHintPrompt(
  exercise: Exercise,
  hintLevel: "direction" | "specific_problem" | "strong_hint",
  learnerAttemptSoFar: string | null,
  locale: Locale = "en",
  learnerLevel?: SkillLevel
) {
  const levelInstruction: Record<typeof hintLevel, string> = {
    direction: "Point toward the relevant concept only. Do not describe the bug or the approach.",
    specific_problem:
      "Identify specifically where the learner's reasoning or code is going wrong, without stating the fix.",
    strong_hint:
      "Explain the correct approach in words, but do NOT write the complete implementation or final answer.",
  };
  return {
    system: `${mentorPersonaFor(learnerLevel)}\n\nYou give progressive hints. Never skip ahead to a later hint level's amount of detail. Return ONLY JSON matching the required schema.${languageInstruction(locale)}`,
    prompt: `Exercise: ${JSON.stringify({ title: exercise.title, prompt: exercise.prompt, type: exercise.type })}
Reference solution (for your eyes only): ${exercise.referenceSolution}
Learner's attempt so far: ${learnerAttemptSoFar ?? "(no attempt yet)"}
Hint level requested: ${hintLevel} — ${levelInstruction[hintLevel]}

Write one hint at exactly this level.`,
  };
}
