import type { ProgrammingLanguage } from "@/types/domain";

/**
 * Maps a topic title to a definite programming language when the title
 * itself names one unambiguously (e.g. "JavaScript", "TypeScript generics",
 * "SQL queries"). This exists because leaving language selection to Gemini's
 * "judgment" for exercise generation caused it to silently generate Python
 * problems for a JavaScript topic — Python is by far the most common
 * language for LeetCode/Codewars-style problems in general training data,
 * so an unconstrained model defaults there even when the topic says
 * otherwise. Language for a topic that literally names a language must be
 * deterministic, not something we ask the AI to "honestly" decide (see the
 * AI/determinism boundary principle — this is exactly that kind of thing).
 *
 * Order matters: more specific patterns (typescript, node.js) are checked
 * before broader ones (javascript) so e.g. "TypeScript" doesn't match a
 * generic "script" substring check.
 */
const LANGUAGE_PATTERNS: Array<{ pattern: RegExp; language: ProgrammingLanguage }> = [
  { pattern: /typescript|\bts\b/i, language: "typescript" },
  { pattern: /node\.?js/i, language: "javascript" },
  { pattern: /react\s*native/i, language: "javascript" },
  { pattern: /react|javascript|\bjs\b|next\.?js|es6|ecmascript/i, language: "javascript" },
  { pattern: /html/i, language: "html" },
  { pattern: /css|flexbox|tailwind|sass|scss/i, language: "css" },
  { pattern: /python|\bpy\b|django|flask/i, language: "python" },
  { pattern: /\bsql\b|postgres|mysql|sqlite|database quer/i, language: "sql" },
  { pattern: /\bjava\b|spring\s*boot|spring\s*framework/i, language: "java" },
];

/**
 * Returns the language a topic title unambiguously implies, or null when
 * the topic is language-agnostic (e.g. "Algorithms", "System Design",
 * "Git workflows") — in that case Gemini's per-problem judgment is fine
 * since there genuinely isn't a single correct answer.
 */
export function inferTopicLanguage(topicTitle: string): ProgrammingLanguage | null {
  for (const { pattern, language } of LANGUAGE_PATTERNS) {
    if (pattern.test(topicTitle)) return language;
  }
  return null;
}

/**
 * Resolves the language a topic should use, falling back to the learning
 * path's own subject when the topic's own title doesn't name one.
 *
 * This is the fix for a real bug: most subtopics in a path don't name a
 * language in their own title (e.g. "Loops", "Recursion", "Functions" under
 * a "JavaScript" learning path). Without this fallback, `inferTopicLanguage`
 * returned null for those, which left the choice to Gemini's "judgment" —
 * and per the module doc above, an unconstrained model defaults to Python
 * regardless of what the learner is actually studying. Checking the parent
 * path's subject first fixes that for the common case; only a genuinely
 * language-agnostic path (e.g. "Algorithms", "System Design") still falls
 * through to null, which is correct — there's no single right language there.
 */
export function resolveTopicLanguage(
  topicTitle: string,
  pathTopic: string | null
): ProgrammingLanguage | null {
  return inferTopicLanguage(topicTitle) ?? (pathTopic ? inferTopicLanguage(pathTopic) : null);
}

// ---------------------------------------------------------------------------
// Project scope (deterministic backstop for buildProjectIdeasPrompt /
// buildProjectPlanPrompt's "HARD CONSTRAINT" text — see lib/prompts.ts)
// ---------------------------------------------------------------------------

/**
 * A topic matches here only when it names ONLY markup/styling technology
 * and nothing else — this is intentionally conservative (a false negative
 * just falls through to Gemini's own judgment, same as today; a false
 * positive would wrongly forbid JS on a topic that actually wanted it).
 */
const MARKUP_ONLY_SIGNAL = /\b(html|css|flexbox|css\s*grid|sass|scss)\b/i;
const NON_MARKUP_SIGNAL =
  /\b(javascript|js|typescript|ts|react|vue|angular|svelte|node\.?js|python|django|flask|\bsql\b|postgres|mysql|database|backend|server|api|rest|graphql|websocket)\b/i;

/**
 * Resolves the set of languages a project is allowed to use, when the
 * topic unambiguously names a markup/styling-only subject — the case the
 * HARD CONSTRAINT text in buildProjectIdeasPrompt/buildProjectPlanPrompt
 * exists for, but which those prompts previously only enforced by asking
 * Gemini to recognize "HTML/CSS" as an example pattern in a free-text
 * topic string it may have invented itself (e.g. an idea's own pitched
 * "topic" label like "Contact form with validation" never says HTML/CSS
 * even when that's genuinely all it needs) — that's what let a REST API
 * project reach a pure-HTML/CSS beginner. Returns null (no constraint,
 * defer entirely to Gemini's own judgment as before) for anything
 * ambiguous or that names non-markup technology.
 *
 * Same "specific topic first, path subject as fallback" shape as
 * resolveTopicLanguage above, for the same reason: individual project
 * ideas/topics rarely restate the path's own subject in their own label.
 */
export function resolveProjectLanguageScope(
  topic: string,
  pathSubject: string | null
): ProgrammingLanguage[] | null {
  const fromTopic = markupOnlyScope(topic);
  if (fromTopic) return fromTopic;
  return pathSubject ? markupOnlyScope(pathSubject) : null;
}

function markupOnlyScope(text: string): ProgrammingLanguage[] | null {
  if (MARKUP_ONLY_SIGNAL.test(text) && !NON_MARKUP_SIGNAL.test(text)) {
    return ["html", "css"];
  }
  return null;
}
