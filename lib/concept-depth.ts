import type { ConceptDepth, LearningStyle, Locale, SkillLevel } from "@/types/domain";

/** Mastery from which someone already has real footing in a topic. */
const FAMILIAR_MASTERY = 60;

/**
 * The lesson depth to pre-select before a session (the learner can switch on
 * the intro screen). A beginner gets the full lesson until they're familiar
 * with the topic; anyone else gets it for a topic they've never attempted,
 * since a new topic makes even an experienced learner a beginner at it.
 */
export function defaultConceptDepth(level: SkillLevel, mastery: number): ConceptDepth {
  if (mastery >= FAMILIAR_MASTERY) return "quick";
  return level === "beginner" || mastery === 0 ? "full" : "quick";
}

/** Bump when the concept prompt/schema changes materially, so cached lessons regenerate. */
export const CONCEPT_PROMPT_VERSION = 1;

/**
 * Cache key for a shared, generated concept. Every field the concept prompt
 * depends on is in it (see ConceptContext in lib/prompts.ts) and nothing
 * else, so two learners with the same key would get the same content anyway.
 */
export function conceptCacheKey(parts: {
  topic: string;
  subtopic: string;
  depth: ConceptDepth;
  level: SkillLevel;
  style: LearningStyle;
  locale: Locale;
}): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    `v${CONCEPT_PROMPT_VERSION}`,
    norm(parts.topic),
    norm(parts.subtopic),
    parts.depth,
    parts.level,
    parts.style,
    parts.locale,
  ].join("|");
}
