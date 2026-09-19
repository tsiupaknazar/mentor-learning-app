/**
 * Orders a learning path's topics the way the Learn tab shows them: roots by
 * `orderIndex`, each followed (depth-first) by its own children, also by
 * `orderIndex`. `orderIndex` only orders siblings, so sorting the flat list
 * by it - or trusting database insertion order - interleaves unrelated
 * levels. A topic whose parent isn't in the list is treated as a root, and
 * any topic unreachable from a root (a malformed parent cycle) is appended
 * at the end - nothing is dropped, and each topic appears exactly once.
 */
export function orderTopicsForLearning<T extends { _id: string; parentTopicId?: string; orderIndex: number }>(
  topics: T[]
): T[] {
  const ids = new Set(topics.map((t) => t._id));
  const byOrder = (a: T, b: T) => a.orderIndex - b.orderIndex;
  const childrenOf = (id: string) => topics.filter((t) => t.parentTopicId === id).sort(byOrder);
  const roots = topics.filter((t) => !t.parentTopicId || !ids.has(t.parentTopicId)).sort(byOrder);

  const ordered: T[] = [];
  const seen = new Set<string>();
  const visit = (topic: T) => {
    if (seen.has(topic._id)) return; // guards against a malformed parent cycle
    seen.add(topic._id);
    ordered.push(topic);
    childrenOf(topic._id).forEach(visit);
  };
  roots.forEach(visit);
  [...topics].sort(byOrder).forEach(visit);
  return ordered;
}
