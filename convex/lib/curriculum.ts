import { orderTopicsForLearning } from "./topicOrder";

/**
 * The rules that decide where a learner is in their learning path, and what
 * they may work on. Pure, so it is shared by every query that needs it (the
 * Learn tree, a single topic, the dashboard) and unit-tested on its own.
 *
 * The principle: **the path decides what's next; practising can never
 * advance or reorder it.** That needs a definition of "done" that a Practice
 * drill can't satisfy, and an order that doesn't depend on the AI's own
 * (frequently empty) prerequisite lists.
 *
 *  - A topic is **passed** when it is mastered, or the learner has finished a
 *    Learn session on it. Attempts made while drilling in Practice never pass
 *    a topic by themselves.
 *  - Topics are taken in path order (parents before their children).
 *  - A topic is **blocked** when
 *      - "order": the learner is on a strict path (beginners) and an earlier
 *        topic isn't passed yet, or
 *      - "prerequisites": a prerequisite the AI named, which comes earlier in
 *        the path, isn't passed yet.
 *    A blocked topic can be neither learned nor practised.
 *  - The first topic that isn't passed is therefore never blocked (everything
 *    before it is passed), so there is always a next step - no dead ends.
 *  - Free-form practice topics the learner added themselves ("ad-hoc") sit
 *    outside the path: never blocked, never ordered, never recommended.
 */

export type BlockReason = "prerequisites" | "order";

export interface CurriculumTopic {
  _id: string;
  externalId: string;
  parentTopicId?: string;
  orderIndex: number;
  prerequisiteExternalIds: string[];
  summary?: string;
  adHoc?: boolean;
}

export interface TopicFacts {
  /** topicProgress.status, when the topic has a progress row. */
  status?: string;
  /** The learner has completed a Learn-mode session on this topic. */
  learned: boolean;
}

export interface TopicAnalysis {
  passed: boolean;
  block: BlockReason | null;
  /**
   * What stands in the way, as topic ids: for "order", the first earlier topic
   * that isn't passed (the one to finish first); for "prerequisites", every
   * unmet prerequisite.
   */
  blockedBy: string[];
}

/** Ad-hoc topics created before the `adHoc` flag existed are recognisable by the summary they were given. */
export const LEGACY_ADHOC_SUMMARY_PREFIX = "Practice topic: ";

export function isAdHocTopic(topic: Pick<CurriculumTopic, "adHoc" | "summary">): boolean {
  return topic.adHoc === true || (topic.summary?.startsWith(LEGACY_ADHOC_SUMMARY_PREFIX) ?? false);
}

/**
 * Whether the learner must follow the path strictly in order. Beginners have
 * no basis for choosing what to skip (a Flexbox drill before HTML basics
 * teaches the wrong thing); everyone else keeps the freedom to work on any
 * topic whose AI-named prerequisites they've passed.
 */
export function usesStrictOrder(level: string | undefined | null): boolean {
  return level === "beginner";
}

export function isPassed(facts: TopicFacts | undefined): boolean {
  return facts?.status === "mastered" || facts?.learned === true;
}

export function analyzeCurriculum(
  topics: CurriculumTopic[],
  facts: Map<string, TopicFacts>,
  options: { strictOrder: boolean }
): Map<string, TopicAnalysis> {
  const result = new Map<string, TopicAnalysis>();

  for (const topic of topics) {
    if (isAdHocTopic(topic)) {
      result.set(topic._id, { passed: isPassed(facts.get(topic._id)), block: null, blockedBy: [] });
    }
  }

  const path = orderTopicsForLearning(topics.filter((t) => !isAdHocTopic(t)));
  const positionById = new Map(path.map((t, i) => [t._id, i]));
  const byExternalId = new Map(path.map((t) => [t.externalId, t]));

  let firstUnpassed: string | null = null; // the earliest topic so far that isn't passed
  path.forEach((topic, position) => {
    const passed = isPassed(facts.get(topic._id));

    // Only prerequisites that come EARLIER in the path count. The AI is asked
    // for "earlier topic ids" but doesn't always comply; a reference to itself
    // or to a later topic could never be satisfied first (the later one is
    // itself waiting behind this one) and would deadlock the path. References
    // to topics that don't exist are ignored, as they always were.
    const unmetPrerequisites = topic.prerequisiteExternalIds
      .map((id) => byExternalId.get(id))
      .filter((p): p is CurriculumTopic => p !== undefined && (positionById.get(p._id) ?? Infinity) < position)
      .filter((p) => !isPassed(facts.get(p._id)))
      .map((p) => p._id);

    let block: BlockReason | null = null;
    let blockedBy: string[] = [];
    if (options.strictOrder && firstUnpassed !== null) {
      block = "order";
      blockedBy = [firstUnpassed];
    } else if (unmetPrerequisites.length > 0) {
      block = "prerequisites";
      blockedBy = unmetPrerequisites;
    }

    result.set(topic._id, { passed, block, blockedBy });
    if (!passed && firstUnpassed === null) firstUnpassed = topic._id;
  });

  return result;
}

/** The first topic in path order that isn't passed (null once the whole path is). Never blocked - see the note above. */
export function findNextTopic<T extends CurriculumTopic>(topics: T[], analysis: Map<string, TopicAnalysis>): T | null {
  return (
    orderTopicsForLearning(topics.filter((t) => !isAdHocTopic(t))).find((t) => analysis.get(t._id)?.passed !== true) ??
    null
  );
}
