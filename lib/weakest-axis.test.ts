import { describe, expect, it } from "vitest";
import { weakestAxis } from "./weakest-axis";

const m = (over: Record<string, number> = {}) => ({
  knowledge: 80,
  application: 80,
  debugging: 80,
  explanation: 80,
  retention: 0,
  ...over,
});

describe("weakestAxis", () => {
  it("names the lowest skill when it is weak", () => {
    expect(weakestAxis(m({ debugging: 20, explanation: 30 }), 3)).toEqual({ axis: "debugging", value: 20 });
  });

  it("returns null when every skill is at least middling", () => {
    expect(weakestAxis(m({ debugging: 45 }), 3)).toBeNull();
    expect(weakestAxis(m(), 3)).toBeNull();
  });

  it("ignores retention, which is 0 for any topic attempted only once", () => {
    expect(weakestAxis(m({ retention: 0 }), 1)).toBeNull();
  });

  it("returns null for a topic that hasn't been attempted - a 0 there means untried, not weak", () => {
    expect(weakestAxis(m({ knowledge: 0, application: 0, debugging: 0, explanation: 0 }), 0)).toBeNull();
  });

  it("rounds the value it reports", () => {
    expect(weakestAxis(m({ application: 33.6 }), 2)).toEqual({ axis: "application", value: 34 });
  });

  it("treats a missing axis as 0", () => {
    expect(weakestAxis({ knowledge: 90, application: 90, debugging: 90 }, 2)).toEqual({ axis: "explanation", value: 0 });
  });
});
