import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackPanel, RewardStrip } from "./feedback-panel";
import type { Evaluation } from "@/lib/schemas";
import { dictionaries } from "@/lib/i18n/dictionaries";

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
  relatedLessonSection: null,
  mentorFollowUp: null,
};

describe("FeedbackPanel: revisiting the lesson", () => {
  const INCORRECT: Evaluation = { ...BASE_EVALUATION, result: "incorrect", relatedLessonSection: "Common mistakes" };

  it("offers to revisit the lesson section the mistake traces to", async () => {
    const onRevisitLesson = vi.fn();
    render(<FeedbackPanel evaluation={INCORRECT} onRevisitLesson={onRevisitLesson} />);

    await userEvent.click(screen.getByRole("button", { name: "Revisit the lesson: Common mistakes" }));

    expect(onRevisitLesson).toHaveBeenCalledWith("Common mistakes");
  });

  it("offers nothing without a section, or without a lesson to go back to", () => {
    const { rerender } = render(<FeedbackPanel evaluation={BASE_EVALUATION} onRevisitLesson={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Revisit the lesson/ })).not.toBeInTheDocument();

    rerender(<FeedbackPanel evaluation={INCORRECT} />);
    expect(screen.queryByRole("button", { name: /Revisit the lesson/ })).not.toBeInTheDocument();
  });
});

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

describe("RewardStrip", () => {
  it("shows the XP earned and the mastery movement", () => {
    render(<RewardStrip reward={{ xpAwarded: 100, masteryBefore: 41.6, masteryAfter: 48.2, newAchievements: [] }} />);
    expect(screen.getByText("+100 XP")).toBeInTheDocument();
    expect(screen.getByText("Topic mastery 42% → 48%")).toBeInTheDocument();
  });

  it("names a newly unlocked achievement from the catalog, with its description", () => {
    render(<RewardStrip reward={{ xpAwarded: 100, masteryBefore: 0, masteryAfter: 8, newAchievements: ["first_win"] }} />);
    expect(screen.getByText("Achievement unlocked")).toBeInTheDocument();
    expect(screen.getByText(dictionaries.en.achievements.catalog.first_win.title)).toBeInTheDocument();
    expect(screen.getByText(dictionaries.en.achievements.catalog.first_win.description)).toBeInTheDocument();
  });

  it("ignores achievement keys it has no catalog entry for", () => {
    render(<RewardStrip reward={{ xpAwarded: 40, masteryBefore: 10, masteryAfter: 12, newAchievements: ["not_a_real_badge"] }} />);
    expect(screen.queryByText("Achievement unlocked")).not.toBeInTheDocument();
    expect(screen.getByText("+40 XP")).toBeInTheDocument();
  });

  it("omits the XP figure for a zero-XP attempt but still reports a mastery drop", () => {
    render(<RewardStrip reward={{ xpAwarded: 0, masteryBefore: 60, masteryAfter: 55, newAchievements: [] }} />);
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
    expect(screen.getByText("Topic mastery 60% → 55%")).toBeInTheDocument();
  });

  it("renders nothing when the attempt earned and changed nothing", () => {
    const { container } = render(
      <RewardStrip reward={{ xpAwarded: 0, masteryBefore: 90, masteryAfter: 90, newAchievements: [] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
