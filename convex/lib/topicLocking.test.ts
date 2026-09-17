import { describe, expect, it } from "vitest";
import { isTopicLocked } from "@/convex/lib/topicLocking";

describe("isTopicLocked", () => {
  it("is never locked with no prerequisites", () => {
    expect(isTopicLocked([], new Map())).toBe(false);
  });

  it("is unlocked once every prerequisite is mastered", () => {
    const statuses = new Map([
      ["closures", "mastered"],
      ["scope", "mastered"],
    ]);
    expect(isTopicLocked(["closures", "scope"], statuses)).toBe(false);
  });

  it("is locked when at least one prerequisite is not mastered", () => {
    const statuses = new Map([
      ["closures", "mastered"],
      ["scope", "in_progress"],
    ]);
    expect(isTopicLocked(["closures", "scope"], statuses)).toBe(true);
  });

  it("treats an unresolvable prerequisite id as satisfied rather than locking the topic", () => {
    const statuses = new Map([["closures", "mastered"]]);
    expect(isTopicLocked(["closures", "some-pruned-topic-id"], statuses)).toBe(false);
  });
});
