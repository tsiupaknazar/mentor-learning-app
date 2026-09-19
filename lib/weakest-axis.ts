export const SKILL_AXES = ["knowledge", "application", "debugging", "explanation"] as const;
export type SkillAxis = (typeof SKILL_AXES)[number];

/** Below this a skill counts as weak (the "weak" band in convex/lib/bands.ts). */
export const WEAK_BELOW = 45;

/**
 * The learner's lowest skill on a topic, if it is genuinely weak - to suggest
 * what to practise. `retention` is left out on purpose: it stays at 0 until a
 * second attempt (a first attempt doesn't claim retention), so it would make
 * every new topic look weak; "is a review due" covers that instead. Returns
 * null for a topic with no attempts, since a 0 there means "untried", not "weak".
 */
export function weakestAxis(
  mastery: Record<string, number>,
  attemptsCount: number
): { axis: SkillAxis; value: number } | null {
  if (attemptsCount <= 0) return null;
  let weakest: { axis: SkillAxis; value: number } | null = null;
  for (const axis of SKILL_AXES) {
    const value = mastery[axis] ?? 0;
    if (weakest === null || value < weakest.value) weakest = { axis, value };
  }
  return weakest && weakest.value < WEAK_BELOW ? { axis: weakest.axis, value: Math.round(weakest.value) } : null;
}
