export type NextActionKind = "review" | "continue" | "start";

/**
 * Where the dashboard's main button leads. A due review is a quick drill of
 * something already learned, so it goes to the practice session (no theory
 * step); continuing or starting a topic goes to the full lesson flow.
 */
export function nextActionTarget(kind: NextActionKind, topicId: string): { href: string; isReview: boolean } {
  const isReview = kind === "review";
  return { href: `/${isReview ? "practice" : "learn"}/${topicId}`, isReview };
}
