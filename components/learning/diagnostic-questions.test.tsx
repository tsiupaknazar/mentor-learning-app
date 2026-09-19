import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DiagnosticQuestions, NOT_SURE, diagnosticAnswerPayload } from "./diagnostic-questions";
import type { DiagnosticSet } from "@/lib/schemas";

const DIAGNOSTIC: DiagnosticSet = {
  topic: "JavaScript",
  questions: [
    {
      id: "q1",
      type: "knowledge",
      subtopic: "Variables",
      prompt: "Which keyword declares a constant?",
      codeSnippet: null,
      choices: ["let", "const", "var"],
    },
    {
      id: "q2",
      type: "explanation",
      subtopic: "Scope",
      prompt: "Explain what a closure captures.",
      codeSnippet: null,
      choices: null,
    },
  ],
};

function Harness({
  onSubmit = vi.fn(),
  error = null,
  initial = {},
}: {
  onSubmit?: () => void;
  error?: string | null;
  initial?: Record<string, string>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  return (
    <DiagnosticQuestions
      diagnostic={DIAGNOSTIC}
      topic="JavaScript"
      answers={answers}
      onAnswer={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
      onSubmit={onSubmit}
      error={error}
    />
  );
}

describe("diagnosticAnswerPayload", () => {
  it("sends real answers as-is, skipped questions as 'no answer', and explicit don't-knows distinctly", () => {
    const payload = diagnosticAnswerPayload(DIAGNOSTIC, { q1: NOT_SURE, q2: "   " });
    expect(payload[0]!.answer).toBe("(learner answered: I don't know)");
    expect(payload[1]!.answer).toBe("(no answer given)");
    expect(payload[0]!.answer).not.toBe(payload[1]!.answer);

    expect(diagnosticAnswerPayload(DIAGNOSTIC, { q1: "const", q2: "It captures scope." }).map((a) => a.answer)).toEqual([
      "const",
      "It captures scope.",
    ]);
  });

  it("carries prompt, type and subtopic through", () => {
    expect(diagnosticAnswerPayload(DIAGNOSTIC, {})[0]).toMatchObject({
      prompt: "Which keyword declares a constant?",
      type: "knowledge",
      subtopic: "Variables",
    });
  });
});

describe("DiagnosticQuestions", () => {
  it("tracks progress, counting an explicit 'I don't know' as answered", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("0 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "const" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I don't know" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("offers 'I don't know' inside a choice question's radio group", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "I don't know" }));
    expect(screen.getByRole("radio", { name: "I don't know" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "const" })).not.toBeChecked();
  });

  it("'I don't know' on a written question disables the box, and toggling it off restores editing", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ q2: "half an answer" }} />);
    const box = screen.getByRole("textbox", { name: "Q2" });
    expect(box).toHaveValue("half an answer");

    const toggle = screen.getByRole("button", { name: "I don't know" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(box).toBeDisabled();
    expect(box).toHaveValue("");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(box).toBeEnabled();
  });

  it("submits straight away when every question is answered", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} initial={{ q1: "const", q2: "It captures scope." }} />);

    await user.click(screen.getByRole("button", { name: "Submit diagnostic" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("asks before submitting with blanks; 'Submit anyway' then goes through", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} initial={{ q1: "const" }} />);

    await user.click(screen.getByRole("button", { name: "Submit diagnostic" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("1 question is unanswered and will count as not known.");

    await user.click(screen.getByRole("button", { name: "Submit anyway" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("'Keep answering' dismisses the warning without submitting", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Submit diagnostic" }));
    expect(screen.getByRole("alert")).toHaveTextContent("2 questions are unanswered");

    await user.click(screen.getByRole("button", { name: "Keep answering" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit diagnostic" })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows an error message as an alert", () => {
    render(<Harness error="Could not score your answers." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not score your answers.");
  });
});
