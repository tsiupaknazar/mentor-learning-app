import { describe, expect, it } from "vitest";
import { nextActionTarget } from "./next-action";

describe("nextActionTarget", () => {
  it("sends a due review to the practice session, without the theory step", () => {
    expect(nextActionTarget("review", "t1")).toEqual({ href: "/practice/t1", isReview: true });
  });

  it("sends continuing or starting a topic to the lesson flow", () => {
    expect(nextActionTarget("continue", "t2")).toEqual({ href: "/learn/t2", isReview: false });
    expect(nextActionTarget("start", "t3")).toEqual({ href: "/learn/t3", isReview: false });
  });
});
