import type { SkillLevel } from "@/types/domain";

/**
 * 0 = a worked example with one blank, 1 = a skeleton with a few blanks.
 * Later exercises get no scaffolding (null).
 */
export type ScaffoldStep = 0 | 1;

/**
 * Beginners get their first two exercises on a topic as faded worked
 * examples (see scaffoldingGuidance in lib/prompts.ts). Keyed on the topic's
 * attempt count rather than position in a session, so it carries across
 * sessions and isn't repeated on a return visit. A "harder variation" is a
 * step up, so it never gets scaffolding.
 */
export function pickScaffolding(level: SkillLevel, attemptsCount: number, challengeMode: boolean): ScaffoldStep | null {
  if (level !== "beginner" || challengeMode) return null;
  if (attemptsCount === 0) return 0;
  if (attemptsCount === 1) return 1;
  return null;
}
