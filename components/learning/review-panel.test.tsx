import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewPanel } from "./review-panel";
import type { Review } from "@/lib/schemas";

const REVIEW: Review = {
  verdict: "changes_requested",
  summary: "Needs a bit more work.",
  comments: [
    { severity: "nit", comment: "Use const instead of let here." },
    { severity: "blocking", comment: "Missing validation on the email field." },
    { severity: "suggestion", comment: "Consider extracting this into a helper." },
  ],
};

describe("ReviewPanel", () => {
  it("renders comments sorted by severity (blocking, suggestion, nit) regardless of input order", () => {
    render(<ReviewPanel review={REVIEW} />);

    const comments = screen.getAllByText(/Missing validation|extracting this|const instead/);
    expect(comments.map((el) => el.textContent)).toEqual([
      "Missing validation on the email field.",
      "Consider extracting this into a helper.",
      "Use const instead of let here.",
    ]);
  });

  it("shows the changes-requested header for a changes_requested verdict", () => {
    render(<ReviewPanel review={REVIEW} />);
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
  });

  it("shows the approved header for an approved verdict", () => {
    render(<ReviewPanel review={{ ...REVIEW, verdict: "approved", comments: [] }} />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders the summary text", () => {
    render(<ReviewPanel review={REVIEW} />);
    expect(screen.getByText("Needs a bit more work.")).toBeInTheDocument();
  });
});
