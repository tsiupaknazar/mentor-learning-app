import { describe, expect, it } from "vitest";
import { TEST_WORKER_SOURCE, collectTestResults, isRunnableTestSuite, runJsTests } from "@/lib/js-tests";

describe("isRunnableTestSuite", () => {
  it("accepts calls with JSON expected values", () => {
    expect(
      isRunnableTestSuite([
        { input: "sum(2, 3)", expectedOutput: "5" },
        { input: "utils.reverse('ab')", expectedOutput: '"ba"' },
        { input: "double([1, 2])", expectedOutput: "[2,4]" },
      ])
    ).toBe(true);
  });

  it("refuses formats it can't run reliably, rather than mis-grading them", () => {
    expect(isRunnableTestSuite(null)).toBe(false);
    expect(isRunnableTestSuite([])).toBe(false);
    for (const bad of [
      { input: "2, 3", expectedOutput: "5" }, // arguments, not a call
      { input: "sum(2, 3", expectedOutput: "5" }, // syntax error
      { input: "sum(2, 3)", expectedOutput: "five" }, // not JSON
      { input: "prints hello", expectedOutput: "hello" },
    ]) {
      expect(isRunnableTestSuite([bad])).toBe(false);
    }
  });

  it("needs every case to fit, not most", () => {
    expect(
      isRunnableTestSuite([
        { input: "sum(2, 3)", expectedOutput: "5" },
        { input: "1, 2", expectedOutput: "3" },
      ])
    ).toBe(false);
  });
});

// The worker's own logic, run here with a fake `self`.
function runInWorker(code: string, tests: Array<{ input: string; expectedOutput: string }>) {
  let posted: Array<{ actual: string | null; passed: boolean; error: string | null }> = [];
  const self = { onmessage: null as null | ((e: { data: unknown }) => void), postMessage: (r: typeof posted) => (posted = r) };
  new Function("self", TEST_WORKER_SOURCE)(self);
  self.onmessage!({ data: { code, tests } });
  return posted;
}

describe("the test worker", () => {
  const SUM = "function sum(a, b) { return a + b; }";

  it("passes and fails each case on its own", () => {
    const results = runInWorker(SUM, [
      { input: "sum(2, 3)", expectedOutput: "5" },
      { input: "sum(2, 2)", expectedOutput: "5" },
    ]);
    expect(results.map((r) => r.passed)).toEqual([true, false]);
    expect(results[1]).toMatchObject({ actual: "4", error: null });
  });

  it("compares objects and arrays by value, ignoring key order", () => {
    const results = runInWorker("const make = () => ({ b: [1, { c: 2 }], a: 1 });", [
      { input: "make()", expectedOutput: '{"a":1,"b":[1,{"c":2}]}' },
      { input: "make()", expectedOutput: '{"a":1,"b":[1,{"c":3}]}' },
    ]);
    expect(results.map((r) => r.passed)).toEqual([true, false]);
  });

  it("reports a thrown error, including a missing function, as a failure with its message", () => {
    const results = runInWorker("function sum() { throw new Error('boom'); }", [
      { input: "sum()", expectedOutput: "1" },
      { input: "missing()", expectedOutput: "1" },
    ]);
    expect(results[0]).toMatchObject({ passed: false, actual: null, error: "boom" });
    expect(results[1]!.passed).toBe(false);
    expect(results[1]!.error).toMatch(/missing/);
  });

  it("evaluates the code fresh for every case, so state can't leak between them", () => {
    const results = runInWorker("let n = 0; function next() { return ++n; }", [
      { input: "next()", expectedOutput: "1" },
      { input: "next()", expectedOutput: "1" },
    ]);
    expect(results.map((r) => r.passed)).toEqual([true, true]);
  });

  it("treats a function that returns nothing as not matching, rather than crashing", () => {
    const results = runInWorker("function noop() {}", [{ input: "noop()", expectedOutput: "1" }]);
    expect(results[0]).toMatchObject({ passed: false, actual: "undefined" });
  });

  it("swallows console output", () => {
    const results = runInWorker("function f() { console.log('x'); return 1; }", [{ input: "f()", expectedOutput: "1" }]);
    expect(results[0]!.passed).toBe(true);
  });
});

describe("running in the browser", () => {
  it("resolves null where there is no Worker to run in (as in these tests)", async () => {
    expect(await runJsTests("function f() {}", [{ input: "f()", expectedOutput: "1" }])).toBeNull();
  });

  it("collects results only for a JavaScript exercise with a runnable suite", async () => {
    const tests = [{ input: "f()", expectedOutput: "1" }];
    expect(await collectTestResults({ language: "python", testCases: tests }, "x")).toBeNull();
    expect(await collectTestResults({ language: "javascript", testCases: null }, "x")).toBeNull();
    expect(await collectTestResults({ language: "javascript", testCases: [{ input: "1, 2", expectedOutput: "3" }] }, "x")).toBeNull();
  });
});
