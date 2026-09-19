import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionHistory, type SessionRow } from "./session-history";

const BASE: SessionRow = {
  _id: "s1",
  topicId: "topic1",
  topicTitle: "Closures",
  startedAt: Date.parse("2024-06-10T12:00:00Z"),
  exercisesCompleted: 3,
  exercisesPlanned: 5,
};

describe("SessionHistory", () => {
  it("says so when there are no sessions", () => {
    render(<SessionHistory sessions={[]} />);
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
  });

  it("names the topic and links back to it", () => {
    render(<SessionHistory sessions={[BASE]} />);
    expect(screen.getByRole("link", { name: "Closures" })).toHaveAttribute("href", "/learn/topic1");
  });

  it("tells finished sessions from unfinished ones", () => {
    render(
      <SessionHistory
        sessions={[
          { ...BASE, _id: "a", completedAt: Date.now(), exercisesCompleted: 5 },
          { ...BASE, _id: "b", topicTitle: "Promises", topicId: "topic2" },
        ]}
      />
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });

  it("shows completed out of planned", () => {
    render(<SessionHistory sessions={[BASE]} />);
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });

  it("never shows more completed than planned, even for older over-counted sessions", () => {
    render(<SessionHistory sessions={[{ ...BASE, exercisesCompleted: 7, completedAt: Date.now() }]} />);
    expect(screen.getByText("5 / 5")).toBeInTheDocument();
    expect(screen.queryByText("7 / 5")).not.toBeInTheDocument();
  });

  it("shows a placeholder, without a dead link, when the topic no longer exists", () => {
    render(<SessionHistory sessions={[{ ...BASE, topicTitle: null }]} />);
    expect(screen.getByText("Unknown topic")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
