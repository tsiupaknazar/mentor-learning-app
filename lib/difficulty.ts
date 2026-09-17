import type { ExerciseDifficulty } from "@/types/domain";

/**
 * "Do not generate random difficulty. Difficulty must depend on the user's
 * previous performance." (spec section 7). This is pure application logic —
 * Gemini receives the resolved difficulty as an instruction, it never picks it.
 */
export function pickDifficulty(
  overallMastery: number,
  attemptsCount: number,
  challengeMode = false
): ExerciseDifficulty {
  let base: ExerciseDifficulty;
  if (attemptsCount === 0) {
    base = "easy";
  } else if (overallMastery < 35) {
    base = "easy";
  } else if (overallMastery < 60) {
    base = "medium";
  } else if (overallMastery < 85) {
    base = "hard";
  } else {
    base = "interview";
  }

  if (!challengeMode) return base;

  const ladder: ExerciseDifficulty[] = ["easy", "medium", "hard", "interview", "real_world"];
  const idx = ladder.indexOf(base);
  return ladder[Math.min(idx + 1, ladder.length - 1)] as ExerciseDifficulty;
}
