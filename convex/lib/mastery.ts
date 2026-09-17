/**
 * All mastery math is deterministic application logic, not AI output
 * (spec section 20: "progress calculations ... should be handled by the
 * application itself"). Gemini only ever supplies per-attempt scores
 * (correctness/logic/codeQuality/bestPractices/edgeCaseHandling); this
 * file is what turns a stream of those into the five-axis mastery score
 * shown on the knowledge map.
 */

export interface AttemptScores {
  correctness: number;
  logic: number;
  codeQuality: number;
  bestPractices: number;
  edgeCaseHandling: number;
}

export interface MasteryScore {
  knowledge: number;
  application: number;
  debugging: number;
  explanation: number;
  retention: number;
  overall: number;
}

const RECENCY_WEIGHT = 0.35; // how much the newest attempt moves the average

/** Exponentially-weighted rolling update so recent attempts matter more than old ones. */
export function rollingUpdate(previous: number, next: number, weight = RECENCY_WEIGHT): number {
  const updated = previous * (1 - weight) + next * weight;
  return Math.max(0, Math.min(100, Math.round(updated)));
}

/**
 * Maps a single attempt's AI-provided scores + exercise type onto the
 * five mastery axes, then folds them into the topic's running mastery.
 */
export function updateMasteryFromAttempt(
  previous: MasteryScore,
  scores: AttemptScores,
  exerciseType: string,
  hasAttemptedBefore: boolean
): MasteryScore {
  const application = rollingUpdate(previous.application, scores.correctness);
  const isDebuggingType = exerciseType === "debugging" || exerciseType === "find_the_bug";
  const debugging = isDebuggingType
    ? rollingUpdate(previous.debugging, (scores.correctness + scores.logic) / 2)
    : previous.debugging;

  const isExplanationType = exerciseType === "explain_code" || exerciseType === "review_code";
  const explanation = isExplanationType
    ? rollingUpdate(previous.explanation, (scores.logic + scores.bestPractices) / 2)
    : previous.explanation;

  const knowledge = rollingUpdate(
    previous.knowledge,
    (scores.correctness + scores.logic + scores.bestPractices) / 3,
    0.25
  );

  // Retention only moves on repeat exposure — a first attempt shouldn't claim retention.
  const retention = hasAttemptedBefore
    ? rollingUpdate(previous.retention, scores.correctness, 0.3)
    : previous.retention;

  const overall = Math.round(
    knowledge * 0.25 + application * 0.3 + debugging * 0.2 + explanation * 0.15 + retention * 0.1
  );

  return { knowledge, application, debugging, explanation, retention, overall };
}

export const EMPTY_MASTERY: MasteryScore = {
  knowledge: 0,
  application: 0,
  debugging: 0,
  explanation: 0,
  retention: 0,
  overall: 0,
};

/** Spaced repetition scheduling (section 13) — deterministic, SM-2-inspired but simplified. */
export function nextReviewDelayMs(overallMastery: number, wasCorrect: boolean): number {
  const day = 24 * 60 * 60 * 1000;
  if (!wasCorrect) return 1 * day;
  if (overallMastery >= 85) return 14 * day;
  if (overallMastery >= 70) return 7 * day;
  if (overallMastery >= 50) return 3 * day;
  return 1 * day;
}
