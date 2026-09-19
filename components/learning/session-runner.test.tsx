import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { SessionRunner } from "./session-runner";

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
}

// Each /api/evaluate call consumes the next scripted verdict (the last one repeats).
let script: ScriptedEvaluation[];
let evaluateCalls: number;
let exerciseNumber: number;
let exerciseOverride: Record<string, unknown>;
// Statuses for successive /api/concept calls (the last one repeats).
let conceptStatuses: number[];
let conceptCalls: number;

const CONCEPT = {
  topic: "Closures",
  subtopic: "Closures",
  explanation: "Closures capture their scope.",
  keyPoints: ["They remember variables", "They outlive the function call"],
  example: null,
};

const startSessionMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  startSessionMock.mockReset().mockResolvedValue("session1");
  script = [{ result: "incorrect", xp: 15, before: 10, after: 14 }];
  evaluateCalls = 0;
  exerciseNumber = 0;
  exerciseOverride = {};
  conceptStatuses = [200];
  conceptCalls = 0;
  vi.mocked(useMutation).mockReturnValue(startSessionMock as never);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/concept") {
        const status = conceptStatuses[Math.min(conceptCalls++, conceptStatuses.length - 1)]!;
        return status === 200 ? jsonResponse({ concept: CONCEPT }) : new Response("{}", { status });
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
        evaluation: { ...EVALUATION, result: step.result, detectedMisconception: step.misconception ?? null },
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
    const CONCEPT_KEY = "unsparing:draft:concept:topic1:en";
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
});
