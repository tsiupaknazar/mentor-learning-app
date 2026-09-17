import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackPanel } from "./feedback-panel";
import type { Evaluation } from "@/lib/schemas";

const BASE_EVALUATION: Evaluation = {
  result: "correct",
  scores: { correctness: 90, logic: 80, codeQuality: 70, bestPractices: 60, edgeCaseHandling: 50 },
  whatYouDid: "Fixed the loop bound.",
  problem: null,
  whyItMatters: null,
  hint: null,
  nextStep: "Try a harder one.",
  detectedMisconception: null,
  detectedMisconceptionKey: null,
  mentorFollowUp: null,
};

describe("FeedbackPanel", () => {
  it.each([
    ["correct", "Correct"],
    ["partially_correct", "Partially correct"],
    ["incorrect", "Incorrect"],
  ] as const)("shows the %s result label", (result, label) => {
    render(<FeedbackPanel evaluation={{ ...BASE_EVALUATION, result }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("always renders whatYouDid and nextStep", () => {
    render(<FeedbackPanel evaluation={BASE_EVALUATION} />);
    expect(screen.getByText("Fixed the loop bound.")).toBeInTheDocument();
    expect(screen.getByText("Try a harder one.")).toBeInTheDocument();
  });

  it("only renders problem/whyItMatters/hint/detectedMisconception when present", () => {
    render(<FeedbackPanel evaluation={BASE_EVALUATION} />);
    expect(screen.queryByText("Problem")).not.toBeInTheDocument();
    expect(screen.queryByText("Why it matters")).not.toBeInTheDocument();
    expect(screen.queryByText("Hint")).not.toBeInTheDocument();
    expect(screen.queryByText("Conceptual gap detected")).not.toBeInTheDocument();
  });

  it("renders problem/whyItMatters/hint/detectedMisconception when set", () => {
    render(
      <FeedbackPanel
        evaluation={{
          ...BASE_EVALUATION,
          problem: "You mutated shared state.",
          whyItMatters: "This causes subtle bugs.",
          hint: "Try returning a new object.",
          detectedMisconception: "Mutating state directly",
        }}
      />
    );
    expect(screen.getByText("You mutated shared state.")).toBeInTheDocument();
    expect(screen.getByText("This causes subtle bugs.")).toBeInTheDocument();
    expect(screen.getByText("Try returning a new object.")).toBeInTheDocument();
    expect(screen.getByText("Mutating state directly")).toBeInTheDocument();
  });

  it("renders all five score rows", () => {
    render(<FeedbackPanel evaluation={BASE_EVALUATION} />);
    for (const label of ["Correctness", "Logic", "Code quality", "Best practices", "Edge cases"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("FeedbackPanel's MentorFollowUp", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const EVALUATION_WITH_FOLLOWUP: Evaluation = {
    ...BASE_EVALUATION,
    mentorFollowUp: "Why did you choose a for loop over a map?",
  };

  it("does not render a reply box with no exerciseId (read-only question)", () => {
    render(<FeedbackPanel evaluation={EVALUATION_WITH_FOLLOWUP} />);
    expect(screen.getByText("Why did you choose a for loop over a map?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Respond" })).not.toBeInTheDocument();
  });

  it("submits a reply and shows the mentor's reaction", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ reaction: { reaction: "Good reasoning.", resolved: true } }), {
        status: 200,
      })
    );
    const user = userEvent.setup();

    render(<FeedbackPanel evaluation={EVALUATION_WITH_FOLLOWUP} exerciseId={"ex1" as never} />);

    await user.type(screen.getByPlaceholderText("Answer the mentor's question…"), "It's more readable.");
    await user.click(screen.getByRole("button", { name: "Respond" }));

    await waitFor(() => expect(screen.getByText("Good reasoning.")).toBeInTheDocument());
    expect(screen.getByText("It's more readable.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/mentor-followup",
      expect.objectContaining({ method: "POST" })
    );
  });
});
