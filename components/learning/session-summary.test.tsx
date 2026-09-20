import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { SessionSummary } from "./session-summary";
import { EMPTY_ROUND_LOG } from "@/lib/round-log";

const props = {
  log: EMPTY_ROUND_LOG,
  topicTitle: "Closures",
  exerciseCount: 5,
  backHref: "/dashboard",
  backLabel: "Back to dashboard",
  onAnotherRound: vi.fn(),
};

describe("SessionSummary", () => {
  it("says the topic isn't marked done yet when the session didn't get enough right", () => {
    render(<SessionSummary {...props} notYetDone />);
    expect(screen.getByText(/isn’t marked done yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Another round" })).toBeInTheDocument();
  });

  it("says nothing of the kind otherwise", () => {
    render(<SessionSummary {...props} />);
    expect(screen.queryByText(/marked done yet/)).not.toBeInTheDocument();
  });
});
