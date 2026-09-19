import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterviewPlaceholder } from "./interview-placeholder";

describe("InterviewPlaceholder", () => {
  it("tells learners plainly that it's coming, without any developer detail", () => {
    const { container } = render(<InterviewPlaceholder />);

    expect(screen.getByRole("heading", { name: "Interview practice — coming soon" })).toBeInTheDocument();
    // Regression: it used to name source files (lib/prompts.ts, lib/gemini.ts) and "MVP scope".
    expect(container.textContent).not.toMatch(/lib\/|\.ts\b|MVP|Gemini|not yet implemented/i);
  });

  it("gives a way back rather than a dead end", () => {
    render(<InterviewPlaceholder />);
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
  });
});
