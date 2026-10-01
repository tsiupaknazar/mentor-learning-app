import "server-only";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexQuery } from "@/lib/convex-server";
import type { LearnerContext } from "@/types/domain";

/**
 * The single place every API route goes to build the context object sent
 * to Gemini. Keeping this in one function (rather than each route
 * re-deriving it) is what makes the "compact context, not full history"
 * rule (spec section 19/31) enforceable in practice.
 */
export async function getLearnerContext(userId: Id<"users">): Promise<LearnerContext> {
  const raw = await convexQuery(api.dashboard.getLearnerContext, { userId });
  if (!raw) {
    throw new Error("No learner context available — user does not exist.");
  }
  return {
    level: raw.level,
    learningGoal: raw.learningGoal,
    learningStyle: raw.learningStyle,
    dailyTime: raw.dailyTime,
    specialty: raw.specialty,
    locale: raw.locale,
    currentTopics: raw.currentTopics,
    weakTopics: raw.weakTopics,
    strongTopics: raw.strongTopics,
    recurringMistakes: raw.recurringMistakes,
    recentPerformance: raw.recentPerformance,
    pathSubject: raw.pathSubject ?? null,
  };
}
