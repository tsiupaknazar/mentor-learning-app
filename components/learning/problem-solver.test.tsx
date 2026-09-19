import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProblemSolver } from "./problem-solver";
import type { ClientExercise } from "@/types/domain";

const EXERCISE: ClientExercise = {
  id: "ex1",
  topic: "Closures",
  subtopic: "Closures",
  type: "implementation",
  difficulty: "easy",
  language: "javascript",
  title: "Explain a closure",
  prompt: "Describe what a closure captures.",
  starterCode: null, // no code editor -> plain textarea answer
  choices: null,
  testCases: null,
  contentLocale: "en",
};

const DRAFT_KEY = "unsparing:draft:exercise:ex1";

function evaluation(result: "correct" | "incorrect") {
  return {
    result,
    scores: { correctness: 50, logic: 50, codeQuality: 50, bestPractices: 50, edgeCaseHandling: 50 },
    whatYouDid: "You answered.",
    problem: null,
    whyItMatters: null,
    hint: null,
    nextStep: "Keep going.",
    detectedMisconception: null,
    detectedMisconceptionKey: null,
    mentorFollowUp: null,
  };
}

let nextResult: "correct" | "incorrect";

beforeEach(() => {
  localStorage.clear();
  nextResult = "incorrect";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/hint"
        ? new Response(JSON.stringify({ hint: { level: "direction", text: "Think about scope." } }), { status: 200 })
        : new Response(
            JSON.stringify({
              evaluation: evaluation(nextResult),
              mastery: {},
              reward: { xpAwarded: 40, masteryBefore: 10, masteryAfter: 15, newAchievements: [] },
            }),
            { status: 200 }
          )
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSolver() {
  return render(<ProblemSolver exerciseId={"ex1" as never} exercise={EXERCISE} />);
}

describe("ProblemSolver draft persistence", () => {
  it("restores the typed answer and the hints already taken after a refresh", async () => {
    const user = userEvent.setup();
    const first = renderSolver();

    await user.type(await screen.findByPlaceholderText("Write your answer…"), "A closure keeps its scope");
    await user.click(screen.getByRole("button", { name: "Hint (0/3)" }));
    expect(await screen.findByText("Think about scope.")).toBeInTheDocument();

    // "Refresh": unmounting flushes the debounced save, a fresh mount reads it back.
    first.unmount();
    renderSolver();

    expect(await screen.findByPlaceholderText("Write your answer…")).toHaveValue("A closure keeps its scope");
    expect(screen.getByText("Think about scope.")).toBeInTheDocument();
    // Hint count survives too - otherwise a refresh would erase the scoring penalty.
    expect(screen.getByRole("button", { name: "Hint (1/3)" })).toBeInTheDocument();
  });

  it("starts empty when there is no draft, and does not write one for untouched input", async () => {
    const { unmount } = renderSolver();
    expect(await screen.findByPlaceholderText("Write your answer…")).toHaveValue("");
    unmount();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("sends the restored hint count with the submission", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        v: { answer: "restored answer", hints: [{ level: "direction", text: "h1" }], solutionRevealed: false },
        t: Date.now(),
      })
    );
    renderSolver();

    await user.click(await screen.findByRole("button", { name: "Submit answer" }));

    const call = vi.mocked(fetch).mock.calls.find(([u]) => u === "/api/evaluate")!;
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({ submittedAnswer: "restored answer", hintsUsed: 1 });
  });

  it("clears the draft once the answer is judged correct, but keeps it for an incorrect one", async () => {
    const user = userEvent.setup();

    // Incorrect: draft is kept for the revision.
    const first = renderSolver();
    await user.type(await screen.findByPlaceholderText("Write your answer…"), "wrong");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await screen.findByRole("button", { name: "Revise and resubmit" });
    first.unmount();
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    // Correct on the revision: draft is gone.
    nextResult = "correct";
    renderSolver();
    await user.click(await screen.findByRole("button", { name: "Submit answer" }));
    await screen.findByText("Correct");
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe("ProblemSolver rewards", () => {
  it("shows the XP and mastery movement after an evaluation", async () => {
    const user = userEvent.setup();
    renderSolver();
    await user.type(await screen.findByPlaceholderText("Write your answer…"), "an answer");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText("+40 XP")).toBeInTheDocument();
    expect(screen.getByText("Topic mastery 10% → 15%")).toBeInTheDocument();
  });
});

describe("ProblemSolver hints", () => {
  it("tells the learner when a hint can't be fetched, and clears the message on the next try", async () => {
    const user = userEvent.setup();
    renderSolver();
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      url === "/api/hint" && fail ? new Response("{}", { status: 500 }) : original(url, init)
    );

    await user.click(await screen.findByRole("button", { name: "Hint (0/3)" }));
    expect(await screen.findByText("Could not get a hint. Try again.")).toBeInTheDocument();
    // A failed hint must not be counted as taken.
    expect(screen.getByRole("button", { name: "Hint (0/3)" })).toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Hint (0/3)" }));
    expect(await screen.findByText("Think about scope.")).toBeInTheDocument();
    expect(screen.queryByText("Could not get a hint. Try again.")).not.toBeInTheDocument();
  });
});

describe("ProblemSolver 'I looked up the answer'", () => {
  const ALL_HINTS = ["direction", "specific_problem", "strong_hint"].map((level) => ({ level, text: `hint ${level}` }));

  it("only appears once every hint is used, then confirms the cost and is sent with the submission", async () => {
    const user = userEvent.setup();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: { answer: "a", hints: [ALL_HINTS[0]], solutionRevealed: false }, t: Date.now() }));
    const { unmount } = renderSolver();
    await screen.findByPlaceholderText("Write your answer…");
    expect(screen.queryByRole("button", { name: /I looked up the answer/ })).not.toBeInTheDocument();
    unmount();

    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: { answer: "a", hints: ALL_HINTS, solutionRevealed: false }, t: Date.now() }));
    renderSolver();
    await user.click(await screen.findByRole("button", { name: "I looked up the answer (earns less XP)" }));

    expect(screen.getByText("Noted — this attempt will earn less XP.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /I looked up the answer/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    const call = vi.mocked(fetch).mock.calls.find(([u]) => u === "/api/evaluate")!;
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({ hintsUsed: 3, solutionRevealed: true });
  });
});
