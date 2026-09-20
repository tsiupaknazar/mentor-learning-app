import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { SessionRunner } from "./session-runner";

const { collectTestResultsMock, trackMock } = vi.hoisted(() => ({ collectTestResultsMock: vi.fn(), trackMock: vi.fn() }));
vi.mock("@/lib/analytics/track", () => ({ track: trackMock }));
vi.mock("@/lib/js-tests", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collectTestResults: collectTestResultsMock,
}));

// CodeMirror is out of scope for component tests - stubbed as a plain
// controlled textarea. The real CodeEditor still runs on top of it, which
// is the point: the regression under test lives in how CodeEditor is
// remounted by SessionRunner, not in the editor widget.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="code" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/lib/format-code", () => ({
  isFormattable: () => false,
  formatCode: vi.fn(async (code: string) => code),
}));

const EXERCISE = {
  id: "ex1",
  topic: "Closures",
  subtopic: "Closures",
  type: "implementation",
  difficulty: "easy",
  language: "javascript",
  title: "Write a counter",
  prompt: "Write a function that returns an incrementing counter.",
  starterCode: "// starter",
  choices: null,
  testCases: null,
};

const EVALUATION = {
  result: "incorrect",
  scores: { correctness: 20, logic: 30, codeQuality: 40, bestPractices: 50, edgeCaseHandling: 10 },
  whatYouDid: "You wrote a function.",
  problem: "It never increments.",
  whyItMatters: null,
  hint: null,
  nextStep: "Use a closure variable.",
  detectedMisconception: null,
  detectedMisconceptionKey: null,
  relatedLessonSection: null,
  mentorFollowUp: null,
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

interface ScriptedEvaluation {
  result: "correct" | "partially_correct" | "incorrect";
  xp: number;
  before: number;
  after: number;
  achievements?: string[];
  misconception?: string;
  relatedLessonSection?: string;
}

// Each /api/evaluate call consumes the next scripted verdict (the last one repeats).
let script: ScriptedEvaluation[];
let evaluateCalls: number;
let exerciseNumber: number;
let exerciseOverride: Record<string, unknown>;
// Statuses for successive /api/concept calls (the last one repeats).
let conceptStatuses: number[];
let conceptCalls: number;
let solutionStatus: number;

const CONCEPT = {
  topic: "Closures",
  subtopic: "Closures",
  explanation: "Closures capture their scope.",
  keyPoints: ["They remember variables", "They outlive the function call"],
  example: null,
};

const startSessionMock = vi.fn();

beforeEach(() => {
  collectTestResultsMock.mockReset().mockResolvedValue(null);
  trackMock.mockReset();
  localStorage.clear();
  startSessionMock.mockReset().mockResolvedValue("session1");
  script = [{ result: "incorrect", xp: 15, before: 10, after: 14 }];
  evaluateCalls = 0;
  exerciseNumber = 0;
  exerciseOverride = {};
  conceptStatuses = [200];
  conceptCalls = 0;
  solutionStatus = 200;
  vi.mocked(useMutation).mockReturnValue(startSessionMock as never);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/concept") {
        const status = conceptStatuses[Math.min(conceptCalls++, conceptStatuses.length - 1)]!;
        return status === 200 ? jsonResponse({ concept: CONCEPT }) : new Response("{}", { status });
      }
      if (url === "/api/hint") {
        return jsonResponse({ hint: { level: "direction", text: "Think about scope." } });
      }
      if (url === "/api/solution") {
        return solutionStatus === 200
          ? jsonResponse({ solution: "const counter = () => n++;" })
          : new Response(JSON.stringify({ error: "solution_unavailable" }), { status: solutionStatus });
      }
      if (url === "/api/exercise") {
        exerciseNumber++;
        return jsonResponse({
          exercise: { ...EXERCISE, title: `Exercise ${exerciseNumber}`, ...exerciseOverride },
          exerciseId: `ex${exerciseNumber}`,
        });
      }
      const step = script[Math.min(evaluateCalls++, script.length - 1)]!;
      return jsonResponse({
        evaluation: {
          ...EVALUATION,
          result: step.result,
          detectedMisconception: step.misconception ?? null,
          relatedLessonSection: step.relatedLessonSection ?? null,
        },
        mastery: {},
        reward: {
          xpAwarded: step.xp,
          masteryBefore: step.before,
          masteryAfter: step.after,
          newAchievements: step.achievements ?? [],
        },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderRunner(props: Partial<React.ComponentProps<typeof SessionRunner>> = {}) {
  return render(
    <SessionRunner
      userId={"user1" as never}
      topicId={"topic1" as never}
      topicTitle="Closures"
      topicSummary="Functions that remember their scope."
      masteryOverall={0}
      mode="practice"
      {...props}
    />
  );
}

describe("SessionRunner", () => {
  it("keeps the learner's code when they choose 'Revise and resubmit'", async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    const editor = await screen.findByLabelText("code");
    expect(editor).toHaveValue("// starter");

    await user.clear(editor);
    await user.type(editor, "const mine = 1;");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    await user.click(await screen.findByRole("button", { name: "Revise and resubmit" }));

    // Previously the editor remounted with the starter code while `answer`
    // still held the old attempt - Submit would send text the learner
    // could no longer see.
    expect(await screen.findByLabelText("code")).toHaveValue("const mine = 1;");
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await waitFor(() => {
      const evaluateCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/evaluate");
      expect(evaluateCalls).toHaveLength(2);
      expect(JSON.parse(evaluateCalls[1]![1]!.body as string).submittedAnswer).toBe("const mine = 1;");
    });
  });

  it("'Another round' starts a fresh five-exercise session with the counter reset", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));

    async function playRound() {
      for (let i = 0; i < 5; i++) {
        const editor = await screen.findByLabelText("code");
        await user.type(editor, " x");
        await user.click(screen.getByRole("button", { name: "Submit answer" }));
        await user.click(await screen.findByRole("button", { name: "Next exercise" }));
      }
    }

    await playRound();
    expect(await screen.findByText("Session complete")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Another round" }));
    await screen.findByLabelText("code");
    expect(screen.getByText("0 / 5")).toBeInTheDocument();

    // Previously the stale count of 5 made round 2 end after one exercise.
    await user.type(screen.getByLabelText("code"), " x");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await user.click(await screen.findByRole("button", { name: "Next exercise" }));
    expect(await screen.findByLabelText("code")).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
    expect(screen.queryByText("Session complete")).not.toBeInTheDocument();
  });

  it("returns to the exercise with the answer intact when the review request fails", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));

    const editor = await screen.findByLabelText("code");
    await user.clear(editor);
    await user.type(editor, "const mine = 1;");

    // First evaluate call fails, the retry succeeds.
    const original = vi.mocked(fetch).getMockImplementation()!;
    let failNext = true;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (url === "/api/evaluate" && failNext) {
        failNext = false;
        return new Response("{}", { status: 502 });
      }
      return original(url, init);
    });

    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    // Not the generic error screen ("Try again" there would fetch a new
    // exercise and wipe the answer): still on the exercise, message shown.
    // A 502 from the route means the AI failed, and the message says so.
    expect(await screen.findByText("The AI service is having trouble right now. Try again in a moment.")).toBeInTheDocument();
    // Announced to screen readers, not just shown.
    expect(screen.getByRole("alert")).toHaveTextContent("The AI service is having trouble right now.");
    expect(screen.getByLabelText("code")).toHaveValue("const mine = 1;");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    const exerciseCalls = () => vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/exercise").length;
    expect(exerciseCalls()).toBe(1);

    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByRole("button", { name: "Revise and resubmit" })).toBeInTheDocument();
    expect(exerciseCalls()).toBe(1);
  });

  describe("resuming an unfinished session", () => {
    const exerciseCalls = () => vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/exercise").length;

    it("offers to resume mid-exercise with the typed code intact", async () => {
      const user = userEvent.setup();
      const first = renderRunner();
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " mine");
      first.unmount(); // a refresh: flushes the debounced save

      renderRunner();
      expect(await screen.findByText("Unfinished session")).toBeInTheDocument();
      expect(screen.getByText(/completed 0 of 5 exercises/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Resume/ }));

      expect(await screen.findByLabelText("code")).toHaveValue("// starter mine");
      // Restored from storage - no new exercise was generated.
      expect(exerciseCalls()).toBe(1);
    });

    it("after an evaluated exercise, resuming banks it and fetches the next one", async () => {
      const user = userEvent.setup();
      const first = renderRunner();
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await screen.findByRole("button", { name: "Next exercise" });
      first.unmount();

      renderRunner();
      expect(await screen.findByText(/completed 1 of 5 exercises/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Resume/ }));

      // Fresh exercise for the same session, counter carried over.
      expect(await screen.findByLabelText("code")).toHaveValue("// starter");
      expect(screen.getByText("1 / 5")).toBeInTheDocument();
      expect(exerciseCalls()).toBe(2);
    });

    it("'Start over' discards the saved session and begins a new one", async () => {
      const user = userEvent.setup();
      const first = renderRunner();
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " old");
      first.unmount();

      renderRunner();
      await user.click(await screen.findByRole("button", { name: "Start over" }));

      expect(await screen.findByLabelText("code")).toHaveValue("// starter");
      expect(exerciseCalls()).toBe(2);
    });

    it("leaves nothing to resume once the session is complete", async () => {
      const user = userEvent.setup();
      const first = renderRunner();
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      for (let i = 0; i < 5; i++) {
        await user.type(await screen.findByLabelText("code"), " x");
        await user.click(screen.getByRole("button", { name: "Submit answer" }));
        await user.click(await screen.findByRole("button", { name: "Next exercise" }));
      }
      await screen.findByText("Session complete");
      first.unmount();

      renderRunner();
      expect(await screen.findByRole("button", { name: "Start practicing" })).toBeInTheDocument();
      expect(screen.queryByText("Unfinished session")).not.toBeInTheDocument();
    });

    it("shows a message when a hint can't be fetched", async () => {
      const user = userEvent.setup();
      renderRunner();
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await screen.findByLabelText("code");

      const original = vi.mocked(fetch).getMockImplementation()!;
      vi.mocked(fetch).mockImplementation(async (url, init) =>
        url === "/api/hint" ? new Response("{}", { status: 500 }) : original(url, init)
      );
      await user.click(screen.getByRole("button", { name: "Hint (0/3)" }));

      expect(await screen.findByText("Could not get a hint. Try again.")).toBeInTheDocument();
    });
  });

  it("shows the XP earned and the mastery movement under the feedback", async () => {
    script = [{ result: "correct", xp: 100, before: 40, after: 48, achievements: ["first_win"] }];
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    await user.type(await screen.findByLabelText("code"), " x");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText("+100 XP")).toBeInTheDocument();
    expect(screen.getByText("Topic mastery 40% → 48%")).toBeInTheDocument();
    expect(screen.getByText("Achievement unlocked")).toBeInTheDocument();
  });

  it("finishes with a summary of the round rather than a bare message", async () => {
    script = [
      { result: "correct", xp: 100, before: 40, after: 46, achievements: ["first_win"] },
      { result: "incorrect", xp: 0, before: 46, after: 44, misconception: "Confuses var and let scoping" },
      { result: "correct", xp: 40, before: 44, after: 50 },
      { result: "partially_correct", xp: 15, before: 50, after: 52 },
      { result: "correct", xp: 100, before: 52, after: 60 },
    ];
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    for (let i = 0; i < 5; i++) {
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await user.click(await screen.findByRole("button", { name: "Next exercise" }));
    }

    expect(await screen.findByText("Session complete")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 correct")).toBeInTheDocument();
    expect(screen.getByText("+255 XP")).toBeInTheDocument();
    expect(screen.getByText("Topic mastery 40% → 60%")).toBeInTheDocument();
    expect(screen.getByText("Achievement unlocked")).toBeInTheDocument();

    // Each answer with its own verdict.
    for (let i = 1; i <= 5; i++) expect(screen.getByText(`Exercise ${i}`)).toBeInTheDocument();
    expect(screen.getAllByText("Correct")).toHaveLength(3);
    expect(screen.getByText("Partially correct")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();

    // The flagged misconception, with a way to see them all - as a client-side link.
    expect(screen.getByText("Confuses var and let scoping")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all mistakes" })).toHaveAttribute("href", "/mistakes");
    expect(screen.getByRole("link", { name: "Back to practice" })).toHaveAttribute("href", "/dashboard");
  });

  it("counts a revised resubmission once, with the latest verdict and XP from both submissions", async () => {
    script = [
      { result: "incorrect", xp: 0, before: 40, after: 38 },
      { result: "correct", xp: 40, before: 38, after: 47 },
    ];
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    await user.type(await screen.findByLabelText("code"), " x");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await user.click(await screen.findByRole("button", { name: "Revise and resubmit" }));
    await user.click(await screen.findByRole("button", { name: "Submit answer" }));
    await screen.findByText("+40 XP");

    for (let i = 0; i < 4; i++) {
      await user.click(await screen.findByRole("button", { name: "Next exercise" }));
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
    }
    await user.click(await screen.findByRole("button", { name: "Next exercise" }));

    expect(await screen.findByText("Session complete")).toBeInTheDocument();
    // 5 exercises, not 6 submissions.
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Topic mastery 40% → 47%")).toBeInTheDocument();
  });

  it("keeps the round summary across a refresh", async () => {
    script = [{ result: "correct", xp: 100, before: 40, after: 48 }];
    const user = userEvent.setup();
    const first = renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    await user.type(await screen.findByLabelText("code"), " x");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await screen.findByRole("button", { name: "Next exercise" });
    first.unmount();

    renderRunner();
    await user.click(await screen.findByRole("button", { name: /Resume/ }));
    for (let i = 0; i < 4; i++) {
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await user.click(await screen.findByRole("button", { name: "Next exercise" }));
    }

    // 1 before the refresh + 4 after = all 5 in the summary.
    expect(await screen.findByText("5 of 5 correct")).toBeInTheDocument();
    expect(screen.getByText("Topic mastery 40% → 48%")).toBeInTheDocument();
  });

  it("renders multiple choice as an accessible radio group and submits the chosen option", async () => {
    exerciseOverride = { type: "multiple_choice", starterCode: null, choices: ["let", "const", "var"] };
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));

    expect(await screen.findByRole("radiogroup", { name: "Exercise 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "const" }));
    expect(screen.getByRole("radio", { name: "const" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    await screen.findByRole("button", { name: "Next exercise" });
    const call = vi.mocked(fetch).mock.calls.find(([u]) => u === "/api/evaluate")!;
    expect(JSON.parse(call[1]!.body as string).submittedAnswer).toBe("const");
  });

  it("submits with Ctrl+Enter from inside the editor, and ignores it while there is no answer", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    const editor = await screen.findByLabelText("code");

    await user.clear(editor);
    await user.type(editor, "{Control>}{Enter}{/Control}");
    expect(vi.mocked(fetch).mock.calls.some(([u]) => u === "/api/evaluate")).toBe(false);

    await user.type(editor, "const done = true;");
    await user.type(editor, "{Control>}{Enter}{/Control}");

    expect(await screen.findByRole("button", { name: "Next exercise" })).toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([u]) => u === "/api/evaluate")!;
    expect(JSON.parse(call[1]!.body as string).submittedAnswer).toBe("const done = true;");
  });

  describe("says what actually went wrong when a review fails", () => {
    async function submitWith(failure: () => Response | Promise<Response>) {
      const user = userEvent.setup();
      renderRunner();
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " x");

      const original = vi.mocked(fetch).getMockImplementation()!;
      vi.mocked(fetch).mockImplementation(async (url, init) => (url === "/api/evaluate" ? failure() : original(url, init)));
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
    }

    it("an expired session tells the learner to sign in again (their work is kept)", async () => {
      await submitWith(() => new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired. Reload the page to sign in again.");
      expect(screen.getByLabelText("code")).toHaveValue("// starter x");
    });

    it("being offline says so", async () => {
      await submitWith(() => {
        throw new TypeError("Failed to fetch");
      });
      expect(await screen.findByRole("alert")).toHaveTextContent("Can’t reach the server. Check your connection and try again.");
    });

    it("an unclassified server error falls back to the feature's own message", async () => {
      await submitWith(() => new Response(JSON.stringify({ error: "internal_error" }), { status: 500 }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not evaluate your answer. Try again.");
    });
  });

  describe("session length follows the learner's daily time", () => {
    async function playOne(user: ReturnType<typeof userEvent.setup>) {
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await user.click(await screen.findByRole("button", { name: "Next exercise" }));
    }

    it("tells the learner how long the session is and why", () => {
      renderRunner({ dailyTime: "15min" });
      expect(screen.getByText("3 exercises, sized to your 15 min / day")).toBeInTheDocument();
    });

    it("says nothing about sizing when no daily time is given, and keeps the default of 5", async () => {
      const user = userEvent.setup();
      renderRunner();
      expect(screen.queryByText(/sized to your/)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      expect(await screen.findByText("0 / 5")).toBeInTheDocument();
      expect(startSessionMock).toHaveBeenCalledWith(expect.objectContaining({ exercisesPlanned: 5 }));
    });

    it("a 15-minute learner gets a 3-exercise session that ends after 3", async () => {
      script = [{ result: "correct", xp: 100, before: 10, after: 12 }];
      const user = userEvent.setup();
      renderRunner({ dailyTime: "15min" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));

      expect(await screen.findByText("0 / 3")).toBeInTheDocument();
      expect(startSessionMock).toHaveBeenCalledWith(expect.objectContaining({ exercisesPlanned: 3 }));

      for (let i = 0; i < 3; i++) await playOne(user);

      expect(await screen.findByText("Session complete")).toBeInTheDocument();
      expect(screen.getByText("3 exercises reviewed on Closures.")).toBeInTheDocument();
      expect(screen.getByText("3 of 3 correct")).toBeInTheDocument();
    });

    it("a learner with 2+ hours is not cut off at 5", async () => {
      script = [{ result: "correct", xp: 100, before: 10, after: 12 }];
      const user = userEvent.setup();
      renderRunner({ dailyTime: "2hr_plus" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      expect(await screen.findByText("0 / 12")).toBeInTheDocument();

      for (let i = 0; i < 5; i++) await playOne(user);

      expect(screen.queryByText("Session complete")).not.toBeInTheDocument();
      expect(await screen.findByText("5 / 12")).toBeInTheDocument();
    });

    it("a resumed session keeps the length it started with, even if the setting changed since", async () => {
      const user = userEvent.setup();
      const first = renderRunner({ dailyTime: "15min" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await playOne(user);
      first.unmount();

      renderRunner({ dailyTime: "1hr" }); // learner has since switched to 1 hour
      expect(await screen.findByText(/completed 1 of 3 exercises/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Resume/ }));
      expect(await screen.findByText("1 / 3")).toBeInTheDocument();

      await playOne(user);
      await playOne(user);
      expect(await screen.findByText("Session complete")).toBeInTheDocument();
    });

    it("'Another round' picks up the current preference", async () => {
      const user = userEvent.setup();
      renderRunner({ dailyTime: "15min" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      for (let i = 0; i < 3; i++) await playOne(user);
      await screen.findByText("Session complete");

      await user.click(screen.getByRole("button", { name: "Another round" }));

      expect(await screen.findByText("0 / 3")).toBeInTheDocument();
      expect(startSessionMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("learn mode: the concept overview", () => {
    const CONCEPT_KEY = "unsparing:draft:concept:topic1:en:full"; // no level given, mastery 0: a new topic, so the full lesson
    const SNAPSHOT_KEY = "unsparing:draft:session:learn:topic1";
    const conceptFetches = () => vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/concept").length;

    it("is requested as soon as the intro shows, so Start doesn't wait for a second request", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "learn" });

      await waitFor(() => expect(conceptFetches()).toBe(1)); // before any click

      await user.click(screen.getByRole("button", { name: "Start session" }));
      expect(await screen.findByText("Closures capture their scope.")).toBeInTheDocument();
      expect(conceptFetches()).toBe(1);
    });

    it("is cached, so the next visit costs no request at all", async () => {
      const user = userEvent.setup();
      const first = renderRunner({ mode: "learn" });
      await waitFor(() => expect(localStorage.getItem(CONCEPT_KEY)).not.toBeNull());
      first.unmount();
      vi.mocked(fetch).mockClear();

      renderRunner({ mode: "learn" });
      await user.click(screen.getByRole("button", { name: "Start session" }));

      expect(await screen.findByText("Closures capture their scope.")).toBeInTheDocument();
      expect(conceptFetches()).toBe(0);
    });

    it("retries once at Start if the background request missed, then shows the concept", async () => {
      conceptStatuses = [500, 200];
      const user = userEvent.setup();
      renderRunner({ mode: "learn" });
      await waitFor(() => expect(conceptFetches()).toBe(1));

      await user.click(screen.getByRole("button", { name: "Start session" }));

      expect(await screen.findByText("Closures capture their scope.")).toBeInTheDocument();
      expect(conceptFetches()).toBe(2);
    });

    it("goes straight to the exercises if the concept can't be produced - theory is optional", async () => {
      conceptStatuses = [500];
      const user = userEvent.setup();
      renderRunner({ mode: "learn" });
      await waitFor(() => expect(conceptFetches()).toBe(1));

      await user.click(screen.getByRole("button", { name: "Start session" }));

      expect(await screen.findByLabelText("code")).toBeInTheDocument();
      expect(conceptFetches()).toBe(2); // the prefetch plus the single retry, no more
      expect(screen.queryByRole("button", { name: "Show theory" })).not.toBeInTheDocument();
    });

    it("is never requested in practice mode", async () => {
      renderRunner({ mode: "practice" });
      await screen.findByRole("button", { name: "Start practicing" });
      await new Promise((r) => setTimeout(r, 20));
      expect(conceptFetches()).toBe(0);
    });

    it("is not prefetched while an unfinished session is on offer, but is fetched if they start over", async () => {
      localStorage.setItem(
        SNAPSHOT_KEY,
        JSON.stringify({
          v: {
            sessionId: "session1",
            completedCount: 1,
            exercise: { ...EXERCISE },
            exerciseId: "ex1",
            answer: "",
            hints: [],
            solutionRevealed: false,
            challengeMode: false,
            planned: 5,
          },
          t: Date.now(),
        })
      );
      const user = userEvent.setup();
      renderRunner({ mode: "learn" });
      await screen.findByText("Unfinished session");
      await new Promise((r) => setTimeout(r, 20));
      expect(conceptFetches()).toBe(0);

      await user.click(screen.getByRole("button", { name: "Start over" }));
      expect(await screen.findByText("Closures capture their scope.")).toBeInTheDocument();
      expect(conceptFetches()).toBe(1);
    });

    it("walks a beginner through a multi-step lesson before the first exercise, and keeps it reopenable", async () => {
      const LESSON = {
        ...CONCEPT,
        sections: [
          { heading: "What is a closure?", body: "A function plus the variables it can see.", example: null },
        ],
      };
      localStorage.setItem(CONCEPT_KEY, JSON.stringify({ v: LESSON, t: Date.now() }));
      const user = userEvent.setup();
      renderRunner({ mode: "learn" });

      await user.click(screen.getByRole("button", { name: "Start session" }));
      expect(await screen.findByText("Step 1 of 3")).toBeInTheDocument();
      expect(screen.queryByLabelText("code")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Next/ }));
      expect(screen.getByRole("heading", { name: "What is a closure?" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Next/ }));
      await user.click(screen.getByRole("button", { name: "Start practicing" }));

      expect(await screen.findByLabelText("code")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show theory" }));
      // Reopened as one page, not the stepper.
      expect(screen.getByRole("heading", { name: "What is a closure?" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Key takeaways" })).toBeInTheDocument();
      expect(screen.queryByText(/Step \d of \d/)).not.toBeInTheDocument();
    });

    describe("choosing how much theory", () => {
      const conceptBodies = () =>
        vi
          .mocked(fetch)
          .mock.calls.filter(([u]) => u === "/api/concept")
          .map(([, init]) => JSON.parse(init!.body as string));
      const pressed = (name: string) => screen.getByRole("button", { name: new RegExp(name) }).getAttribute("aria-pressed");

      it("pre-selects the full lesson for a beginner, and asks the server for it", async () => {
        renderRunner({ mode: "learn", level: "beginner", masteryOverall: 30 });

        expect(pressed("Full lesson")).toBe("true");
        expect(pressed("Quick refresher")).toBe("false");
        await waitFor(() => expect(conceptBodies()).toHaveLength(1));
        expect(conceptBodies()[0]).toMatchObject({ subtopic: "Closures", depth: "full" });
      });

      it("pre-selects the quick refresher for someone with footing in the topic", async () => {
        renderRunner({ mode: "learn", level: "junior", masteryOverall: 40 });

        expect(pressed("Quick refresher")).toBe("true");
        await waitFor(() => expect(conceptBodies()[0]).toMatchObject({ depth: "quick" }));
      });

      it("pre-selects the full lesson for anyone on a topic they've never attempted", () => {
        renderRunner({ mode: "learn", level: "advanced", masteryOverall: 0 });
        expect(pressed("Full lesson")).toBe("true");
      });

      it("fetches the other depth when the learner switches, and starts with that one", async () => {
        const user = userEvent.setup();
        renderRunner({ mode: "learn", level: "beginner", masteryOverall: 0 });
        await waitFor(() => expect(conceptBodies()).toHaveLength(1));

        await user.click(screen.getByRole("button", { name: /Quick refresher/ }));
        await waitFor(() => expect(conceptBodies()).toHaveLength(2));
        expect(conceptBodies()[1]).toMatchObject({ depth: "quick" });
        expect(pressed("Quick refresher")).toBe("true");

        await user.click(screen.getByRole("button", { name: "Start session" }));
        expect(await screen.findByText("Closures capture their scope.")).toBeInTheDocument();
        expect(conceptBodies()).toHaveLength(2); // the prefetch for the chosen depth was reused
      });

      it("keeps each depth's lesson cached separately", async () => {
        const user = userEvent.setup();
        renderRunner({ mode: "learn", level: "beginner", masteryOverall: 0 });
        await waitFor(() => expect(localStorage.getItem("unsparing:draft:concept:topic1:en:full")).not.toBeNull());

        await user.click(screen.getByRole("button", { name: /Quick refresher/ }));
        await waitFor(() => expect(localStorage.getItem("unsparing:draft:concept:topic1:en:quick")).not.toBeNull());
        expect(localStorage.getItem("unsparing:draft:concept:topic1:en:full")).not.toBeNull();
      });

      it("isn't offered when drilling in practice mode, which has no theory", async () => {
        renderRunner({ mode: "practice", level: "beginner" });
        await screen.findByRole("button", { name: "Start practicing" });
        expect(screen.queryByText("Theory before you start")).not.toBeInTheDocument();
      });
    });

    describe("tying feedback back to the lesson", () => {
      const LESSON = {
        ...CONCEPT,
        sections: [
          { heading: "What is a closure?", body: "A function plus the variables it can see.", example: null, check: null },
          { heading: "Common mistakes", body: "Forgetting the variable lives on.", example: null, check: null },
        ],
      };
      const evaluateBodies = () =>
        vi
          .mocked(fetch)
          .mock.calls.filter(([u]) => u === "/api/evaluate")
          .map(([, init]) => JSON.parse(init!.body as string));

      async function reachFeedback(user: ReturnType<typeof userEvent.setup>) {
        localStorage.setItem(CONCEPT_KEY, JSON.stringify({ v: LESSON, t: Date.now() }));
        renderRunner({ mode: "learn" });
        await user.click(screen.getByRole("button", { name: "Start session" }));
        for (let i = 0; i < 4; i++) await user.click(await screen.findByRole("button", { name: /Next|Start practicing/ }));
        await user.type(await screen.findByLabelText("code"), " x");
        await user.click(screen.getByRole("button", { name: "Submit answer" }));
      }

      it("sends the lesson's headings with the answer, so the review can point at one", async () => {
        script = [{ result: "incorrect", xp: 0, before: 10, after: 9 }];
        await reachFeedback(userEvent.setup());
        await screen.findByRole("button", { name: "Next exercise" });

        expect(evaluateBodies()[0].lessonSections).toEqual(["What is a closure?", "Common mistakes"]);
      });

      it("sends none when there's no multi-section lesson (a quick concept, or practice)", async () => {
        script = [{ result: "incorrect", xp: 0, before: 10, after: 9 }];
        const user = userEvent.setup();
        renderRunner({ mode: "practice" });
        await user.click(screen.getByRole("button", { name: "Start practicing" }));
        await user.type(await screen.findByLabelText("code"), " x");
        await user.click(screen.getByRole("button", { name: "Submit answer" }));
        await screen.findByRole("button", { name: "Next exercise" });

        expect(evaluateBodies()[0].lessonSections).toBeUndefined();
      });

      it("reopens the lesson at the section the review names, from the feedback screen", async () => {
        script = [{ result: "incorrect", xp: 0, before: 10, after: 9, relatedLessonSection: "Common mistakes" }];
        const user = userEvent.setup();
        await reachFeedback(user);

        await user.click(await screen.findByRole("button", { name: "Revisit the lesson: Common mistakes" }));

        expect(screen.getByRole("heading", { name: "Common mistakes" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "What is a closure?" })).toBeInTheDocument();
      });
    });

    it("brings back 'Show theory' when resuming, if the overview is still cached", async () => {
      localStorage.setItem(CONCEPT_KEY, JSON.stringify({ v: CONCEPT, t: Date.now() }));
      localStorage.setItem(
        SNAPSHOT_KEY,
        JSON.stringify({
          v: {
            sessionId: "session1",
            completedCount: 0,
            exercise: { ...EXERCISE },
            exerciseId: "ex1",
            answer: "",
            hints: [],
            solutionRevealed: false,
            challengeMode: false,
            planned: 5,
          },
          t: Date.now(),
        })
      );
      const user = userEvent.setup();
      renderRunner({ mode: "learn" });

      await user.click(await screen.findByRole("button", { name: /Resume/ }));

      expect(await screen.findByRole("button", { name: "Show theory" })).toBeInTheDocument();
      expect(conceptFetches()).toBe(0);
    });
  });

  describe("whether the topic counts as learned", () => {
    async function playRound(user: ReturnType<typeof userEvent.setup>, mode: "learn" | "practice") {
      renderRunner({ mode, dailyTime: "15min" }); // 3 exercises
      await user.click(screen.getByRole("button", { name: mode === "learn" ? "Start session" : "Start practicing" }));
      if (mode === "learn") await user.click(await screen.findByRole("button", { name: "Start practicing" }));
      for (let i = 0; i < 3; i++) {
        await user.type(await screen.findByLabelText("code"), " x");
        await user.click(screen.getByRole("button", { name: "Submit answer" }));
        await user.click(await screen.findByRole("button", { name: "Next exercise" }));
      }
      await screen.findByText("Session complete");
    }

    it("tells a learner whose Learn session went badly that the topic isn't done yet", async () => {
      script = [{ result: "incorrect", xp: 0, before: 0, after: 0 }];
      await playRound(userEvent.setup(), "learn");
      expect(screen.getByText(/isn’t marked done yet/)).toBeInTheDocument();
    });

    it("doesn't, when enough went right", async () => {
      script = [
        { result: "correct", xp: 100, before: 0, after: 20 },
        { result: "partially_correct", xp: 15, before: 20, after: 25 },
        { result: "incorrect", xp: 0, before: 25, after: 24 },
      ];
      await playRound(userEvent.setup(), "learn");
      expect(screen.queryByText(/marked done yet/)).not.toBeInTheDocument();
    });

    it("never mentions it for a Practice drill, which doesn't count toward learning a topic anyway", async () => {
      script = [{ result: "incorrect", xp: 0, before: 0, after: 0 }];
      await playRound(userEvent.setup(), "practice");
      expect(screen.queryByText(/marked done yet/)).not.toBeInTheDocument();
    });
  });

  describe("analytics", () => {
    const events = (name: string) => trackMock.mock.calls.filter(([n]) => n === name).map(([, p]) => p);

    it("records a session starting and, when the last exercise is done, finishing", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "practice", dailyTime: "15min" }); // 3 exercises
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      expect(events("session_started")).toEqual([expect.objectContaining({ subtopic: "Closures", mode: "practice", depth: null })]);
      expect(events("session_completed")).toEqual([]);

      for (let i = 0; i < 3; i++) {
        await user.type(await screen.findByLabelText("code"), " x");
        await user.click(screen.getByRole("button", { name: "Submit answer" }));
        await user.click(await screen.findByRole("button", { name: "Next exercise" }));
      }

      expect(events("session_completed")).toEqual([expect.objectContaining({ mode: "practice", exercises: 3 })]);
    });

    it("records which theory depth the learner chose", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "learn", level: "beginner" });
      await user.click(screen.getByRole("button", { name: /Quick refresher/ }));
      expect(events("lesson_depth_selected")).toEqual([{ subtopic: "Closures", depth: "quick", level: "beginner" }]);
    });

    it("records the solution being shown", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "practice" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await user.click(await screen.findByRole("button", { name: "Show the solution" }));
      await screen.findByText("Worked solution");
      expect(events("solution_shown")).toEqual([expect.objectContaining({ subtopic: "Closures", hintsUsed: 0 })]);
    });
  });

  describe("sending the code's test results with the answer", () => {
    const evaluateBody = () =>
      vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/evaluate").map(([, i]) => JSON.parse(i!.body as string))[0];

    it("runs the tests first and sends what happened", async () => {
      const results = [{ input: "counter()", expected: "1", actual: "1", passed: true, error: null }];
      collectTestResultsMock.mockResolvedValue(results);
      const user = userEvent.setup();
      renderRunner({ mode: "practice" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " x");

      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await screen.findByRole("button", { name: "Next exercise" });

      expect(collectTestResultsMock).toHaveBeenCalledWith(expect.objectContaining({ language: "javascript" }), "// starter x");
      expect(evaluateBody().testResults).toEqual(results);
    });

    it("sends none when there's nothing runnable, and doesn't try for answers that aren't code", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "practice" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await screen.findByRole("button", { name: "Next exercise" });
      expect(evaluateBody().testResults).toBeUndefined();

      collectTestResultsMock.mockClear();
      exerciseOverride = { type: "explain_code", starterCode: "const a = 1;" };
      await user.click(screen.getByRole("button", { name: "Next exercise" }));
      await user.type(await screen.findByPlaceholderText(/reasoning|explain/i), "because");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/evaluate")).toHaveLength(2));
      expect(collectTestResultsMock).not.toHaveBeenCalled();
    });
  });

  describe("getting unstuck", () => {
    async function reachIncorrectFeedback(user: ReturnType<typeof userEvent.setup>) {
      renderRunner({ mode: "practice" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await user.type(await screen.findByLabelText("code"), " x");
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await screen.findByRole("button", { name: "Next exercise" });
    }

    it("offers the worked solution after a miss, and keeps it in view while revising", async () => {
      const user = userEvent.setup();
      await reachIncorrectFeedback(user);
      expect(screen.queryByText("Worked solution")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Show the solution" }));

      expect(await screen.findByText("Worked solution")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Show the solution" })).not.toBeInTheDocument();
      expect(vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/solution")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Revise and resubmit" }));
      // The editor and the (read-only) solution are both on screen; CodeMirror is stubbed as a textarea.
      expect(await screen.findByRole("button", { name: "Submit answer" })).toBeInTheDocument();
      expect(screen.getAllByLabelText("code")).toHaveLength(2);
      expect(screen.getByText("Worked solution")).toBeInTheDocument();

      // ...and what's submitted from here is flagged as having seen it.
      await user.click(screen.getByRole("button", { name: "Submit answer" }));
      await waitFor(() => {
        const bodies = vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/evaluate").map(([, i]) => JSON.parse(i!.body as string));
        expect(bodies.at(-1).solutionRevealed).toBe(true);
      });
    });

    it("doesn't offer it after a correct answer", async () => {
      script = [{ result: "correct", xp: 100, before: 0, after: 20 }];
      const user = userEvent.setup();
      await reachIncorrectFeedback(user);
      expect(screen.queryByRole("button", { name: "Show the solution" })).not.toBeInTheDocument();
    });

    it("says so when the solution can't be loaded, and lets the learner retry", async () => {
      solutionStatus = 403;
      const user = userEvent.setup();
      await reachIncorrectFeedback(user);

      await user.click(screen.getByRole("button", { name: "Show the solution" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show the solution" })).toBeEnabled();
    });

    it("tells someone out of hints what to do next", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "practice" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await screen.findByLabelText("code");
      expect(screen.queryByText(/see a worked solution/)).not.toBeInTheDocument();

      for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: /Hint|hint/ }));

      expect(await screen.findByText(/see a worked solution/)).toBeInTheDocument();
    });
  });

  describe("which flow started the session", () => {
    it("a Practice drill is recorded as practice, so it can't count as having learned the topic", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "practice" });
      await user.click(screen.getByRole("button", { name: "Start practicing" }));
      await screen.findByLabelText("code");
      expect(startSessionMock).toHaveBeenCalledWith(expect.objectContaining({ mode: "practice" }));
    });

    it("a lesson from the Learn page is recorded as learn", async () => {
      const user = userEvent.setup();
      renderRunner({ mode: "learn" });
      await user.click(screen.getByRole("button", { name: "Start session" }));
      await user.click(await screen.findByRole("button", { name: "Start practicing" }));
      await screen.findByLabelText("code");
      expect(startSessionMock).toHaveBeenCalledWith(expect.objectContaining({ mode: "learn" }));
    });
  });
});
