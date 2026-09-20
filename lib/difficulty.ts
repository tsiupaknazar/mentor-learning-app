import type { ExerciseDifficulty, SkillLevel } from "@/types/domain";

const LADDER: ExerciseDifficulty[] = ["easy", "medium", "hard", "interview", "real_world"];

/**
 * "Do not generate random difficulty. Difficulty must depend on the user's
 * previous performance." (spec section 7). This is pure application logic —
 * Gemini receives the resolved difficulty as an instruction, it never picks it.
 */
export function pickDifficulty(
  overallMastery: number,
  attemptsCount: number,
  challengeMode = false,
  level?: SkillLevel
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

  const bumped = challengeMode ? LADDER[Math.min(LADDER.indexOf(base) + 1, LADDER.length - 1)]! : base;
  // "Interview" and "real world" assume working experience: a beginner's
  // ceiling is "hard", however well they are doing.
  return level === "beginner" && LADDER.indexOf(bumped) > LADDER.indexOf("hard") ? "hard" : bumped;
}
