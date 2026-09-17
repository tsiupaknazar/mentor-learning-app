import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LearnPathView, type LearnTopicRow } from "./learn-path-view";

const PATH = { title: "JS Path", rationale: "Because you're learning JavaScript." };

function topic(overrides: Partial<LearnTopicRow>): LearnTopicRow {
  return {
    _id: "t1",
    externalId: "closures",
    title: "Closures",
    summary: "Closures summary",
    orderIndex: 0,
    prerequisiteExternalIds: [],
    locked: false,
    progress: null,
    ...overrides,
  };
}

describe("LearnPathView", () => {
  it("renders an unlocked, not-started topic as a real link with a 'not started' badge", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[topic({ _id: "t1" })]}
      />
    );

    const link = screen.getByRole("link", { name: /Closures/ });
    expect(link).toHaveAttribute("href", "/learn/t1");
    expect(screen.getByText("not started")).toBeInTheDocument();
  });

  it("renders a locked topic as a non-clickable block naming its prerequisite by title, not raw id", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[
          topic({ _id: "t1", externalId: "functions", title: "Functions", summary: "Functions summary" }),
          topic({
            _id: "t2",
            externalId: "closures",
            title: "Closures",
            locked: true,
            prerequisiteExternalIds: ["functions"],
          }),
        ]}
      />
    );

    expect(screen.queryByRole("link", { name: /Closures/ })).not.toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(screen.getByText("Requires: Functions")).toBeInTheDocument();
  });

  it("shows a mastery percentage badge for a topic with progress instead of 'not started'", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[
          topic({
            progress: { mastery: { overall: 72 }, status: "in_progress", attemptsCount: 3 },
          }),
        ]}
      />
    );

    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.queryByText("not started")).not.toBeInTheDocument();
  });

  it("links 'Start a new topic' to /learn/new", () => {
    render(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[]} />);
    expect(screen.getByRole("link", { name: "Start a new topic" })).toHaveAttribute("href", "/learn/new");
  });
});
