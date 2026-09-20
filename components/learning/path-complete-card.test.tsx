import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PathCompleteCard } from "./path-complete-card";

describe("PathCompleteCard", () => {
  it("says the path is finished, rather than that there is no path", () => {
    render(<PathCompleteCard />);
    expect(screen.getByRole("heading", { name: "You’ve completed this learning path" })).toBeInTheDocument();
    expect(screen.queryByText(/Complete onboarding/)).not.toBeInTheDocument();
  });

  it("points onward: a new topic, or more practice", () => {
    render(<PathCompleteCard />);
    expect(screen.getByRole("link", { name: "Start a new topic" })).toHaveAttribute("href", "/learn/new");
    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute("href", "/practice");
  });
});
