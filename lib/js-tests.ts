export interface JsTestCase {
  input: string;
  expectedOutput: string;
}

export interface TestResult {
  input: string;
  expected: string;
  /** What the code produced (JSON-ish, truncated), or null if it threw or timed out. */
  actual: string | null;
  passed: boolean;
  error: string | null;
}

/** The contract exercises are asked to follow; anything else isn't run rather than mis-graded. */
const CALL_EXPRESSION = /^[A-Za-z_$][\w$.]*\s*\(/;

/**
 * Whether every test case follows the runnable contract: `input` is a JS
 * expression calling the learner's function (e.g. `sum(2, 3)`) and
 * `expectedOutput` is the JSON of the value it should return. Tests written
 * in any other format (older exercises, free-form ones) can't be run
 * reliably, and a wrong "failed" shown as fact would be worse than no result,
 * so the whole suite is skipped unless every case fits.
 */
export function isRunnableTestSuite(tests: JsTestCase[] | null | undefined): tests is JsTestCase[] {
  if (!tests || tests.length === 0) return false;
  return tests.every((t) => {
    if (!CALL_EXPRESSION.test(t.input.trim())) return false;
    try {
      new Function(`return (${t.input});`); // compiled to check the syntax, never called
      JSON.parse(t.expectedOutput);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Runs inside a Web Worker (like the editor's Run): each test evaluates the
 * learner's code fresh, so one case can't leak state into the next, then the
 * test's expression, and compares the value to the expected JSON.
 */
export const TEST_WORKER_SOURCE = `
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
};
const show = (v) => {
  try { return String(v === undefined ? "undefined" : JSON.stringify(v)).slice(0, 300); }
  catch { return String(v).slice(0, 300); }
};
const quiet = { log() {}, info() {}, warn() {}, error() {} };
self.onmessage = (e) => {
  const { code, tests } = e.data;
  const results = tests.map((t) => {
    try {
      const actual = new Function("console", code + "\\n;return (" + t.input + ");")(quiet);
      return { actual: show(actual), passed: deepEqual(actual, JSON.parse(t.expectedOutput)), error: null };
    } catch (err) {
      return { actual: null, passed: false, error: String(err && err.message ? err.message : err).slice(0, 300) };
    }
  });
  self.postMessage(results);
};
`;

const TIMEOUT_MS = 3000;

/**
 * Runs the learner's JavaScript against runnable test cases. Resolves null
 * where there's no Worker to run in. A hang (an infinite loop) ends the run
 * after 3s with every case reported as timed out.
 */
export function runJsTests(code: string, tests: JsTestCase[], timeoutMs = TIMEOUT_MS): Promise<TestResult[] | null> {
  if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL.createObjectURL !== "function") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([TEST_WORKER_SOURCE], { type: "application/javascript" }));
    const worker = new Worker(url);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (results: TestResult[] | null) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(results);
    };
    timer = setTimeout(
      () =>
        finish(
          tests.map((t) => ({ input: t.input, expected: t.expectedOutput, actual: null, passed: false, error: "timed out" }))
        ),
      timeoutMs
    );
    worker.onmessage = (e: MessageEvent<Array<Pick<TestResult, "actual" | "passed" | "error">>>) =>
      finish(e.data.map((r, i) => ({ input: tests[i]!.input, expected: tests[i]!.expectedOutput, ...r })));
    worker.onerror = () => finish(null);
    worker.postMessage({ code, tests });
  });
}

/** Test results to send with an answer for review: only for JavaScript with a runnable suite. */
export function collectTestResults(
  exercise: { language: string; testCases: JsTestCase[] | null },
  answer: string
): Promise<TestResult[] | null> {
  if (exercise.language !== "javascript" || !isRunnableTestSuite(exercise.testCases)) return Promise.resolve(null);
  return runJsTests(answer, exercise.testCases).catch(() => null);
}
