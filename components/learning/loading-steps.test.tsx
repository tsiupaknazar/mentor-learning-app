import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LoadingSteps } from "./loading-steps";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const MESSAGES = ["Step one…", "Step two…", "Step three…"];

describe("LoadingSteps", () => {
  it("starts on the first message and announces it as a polite status", () => {
    render(<LoadingSteps messages={MESSAGES} />);
    expect(screen.getByRole("status")).toHaveTextContent("Step one…");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("advances through the messages and holds on the last one", () => {
    render(<LoadingSteps messages={MESSAGES} intervalMs={1000} />);

    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText("Step two…")).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText("Step three…")).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.getByText("Step three…")).toBeInTheDocument(); // doesn't run off the end
  });

  it("only reassures once the wait passes the slow threshold", () => {
    render(<LoadingSteps messages={MESSAGES} intervalMs={1000} slowAfterMs={5000} />);
    expect(screen.queryByText(/Still working/)).not.toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.queryByText(/Still working/)).not.toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText("Still working — this can take a moment.")).toBeInTheDocument();
  });

  it("renders the skeleton only when asked", () => {
    const { container, rerender } = render(<LoadingSteps messages={MESSAGES} />);
    expect(container.querySelector(".animate-pulse")).toBeNull();

    rerender(<LoadingSteps messages={MESSAGES} skeleton />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("copes with a single message", () => {
    render(<LoadingSteps messages={["Only one…"]} intervalMs={1000} />);
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.getByText("Only one…")).toBeInTheDocument();
  });
});
