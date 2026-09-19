import { describe, expect, it } from "vitest";
import { orderTopicsForLearning } from "./topicOrder";

const t = (_id: string, orderIndex: number, parentTopicId?: string) => ({ _id, orderIndex, parentTopicId });

describe("orderTopicsForLearning", () => {
  it("orders roots by orderIndex, regardless of input order", () => {
    expect(orderTopicsForLearning([t("b", 1), t("a", 0), t("c", 2)]).map((x) => x._id)).toEqual(["a", "b", "c"]);
  });

  it("puts each topic's children right after it, depth-first", () => {
    const ordered = orderTopicsForLearning([
      t("r2", 1),
      t("r1-c2", 1, "r1"),
      t("r1", 0),
      t("r1-c1", 0, "r1"),
      t("r1-c1-g", 0, "r1-c1"),
    ]);
    expect(ordered.map((x) => x._id)).toEqual(["r1", "r1-c1", "r1-c1-g", "r1-c2", "r2"]);
  });

  it("treats a topic whose parent is missing as a root instead of dropping it", () => {
    expect(orderTopicsForLearning([t("orphan", 0, "gone"), t("root", 1)]).map((x) => x._id)).toEqual(["orphan", "root"]);
  });

  it("keeps every topic exactly once, even with a parent cycle", () => {
    const ordered = orderTopicsForLearning([t("root", 0), t("a", 0, "b"), t("b", 0, "a")]);
    // The cycle is unreachable from any root; it is appended, not lost or duplicated.
    expect(ordered.map((x) => x._id)).toEqual(["root", "a", "b"]);
  });

  it("returns an empty list for no topics", () => {
    expect(orderTopicsForLearning([])).toEqual([]);
  });
});
