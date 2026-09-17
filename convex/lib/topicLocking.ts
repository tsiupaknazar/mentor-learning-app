/**
 * Deterministic prerequisite-gating for the Learn tab. Gemini generates
 * each topic's `prerequisiteExternalIds` when the path is created (see
 * lib/prompts.ts buildLearningPathPrompt), but whether that actually
 * BLOCKS a topic until its prerequisites are mastered is application
 * logic, not something the model decides — same reasoning as mastery/XP
 * math in mastery.ts/xp.ts.
 *
 * A topic is locked until every prerequisite it names is "mastered". An
 * id that can't be resolved to a known sibling topic (e.g. references
 * something pruned from the tree, or genuinely doesn't exist) is treated
 * as satisfied rather than permanently locking the topic — better to
 * under-gate than to strand a learner behind a broken reference.
 */
export function isTopicLocked(
  prerequisiteExternalIds: string[],
  statusByExternalId: Map<string, string | undefined>
): boolean {
  if (prerequisiteExternalIds.length === 0) return false;
  return !prerequisiteExternalIds.every((id) => {
    const status = statusByExternalId.get(id);
    return status === undefined || status === "mastered";
  });
}
