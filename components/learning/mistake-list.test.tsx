import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation } from "convex/react";
import { MistakeList } from "./mistake-list";

const OPEN_MISTAKE = {
  _id: "m1",
  topicId: "topic1",
  description: "Off-by-one in loop bound",
  firstDetectedAt: Date.parse("2024-01-01"),
  lastDetectedAt: Date.parse("2024-01-05"),
  occurrences: 2,
  status: "open" as const,
  consecutiveCleanAttempts: 0,
  contentLocale: "en" as const,
};

function mockQueries(open: unknown[], resolved: unknown[]) {
  vi.mocked(useQuery).mockImplementation((_query, args?) => {
    if (args && typeof args === "object" && "limit" in args) return resolved;
    return open;
  });
}

const markResolvedMock = vi.fn();

beforeEach(() => {
  vi.mocked(useMutation).mockReturnValue(markResolvedMock as never);
  markResolvedMock.mockReset();
});

describe("MistakeList", () => {
  it("shows a loading spinner while mistakes are undefined", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { container } = render(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading…" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no open mistakes", () => {
    mockQueries([], []);
    render(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);
    expect(screen.getByText("No recurring mistakes yet — nothing to review.")).toBeInTheDocument();
  });

  it("gives an occurrence-≥3 mistake the destructive badge treatment (conceptual gap), below 3 a plain occurrence count", () => {
    mockQueries([{ ...OPEN_MISTAKE, occurrences: 3 }], []);
    render(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);
    expect(screen.getByText(/×3.*conceptual gap/)).toBeInTheDocument();
  });

  it("shows a plain occurrence count with no 'conceptual gap' label below the threshold", () => {
    mockQueries([{ ...OPEN_MISTAKE, occurrences: 2 }], []);
    render(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);
    expect(screen.getByText("×2")).toBeInTheDocument();
  });

  it("only renders the resolved section when there are resolved mistakes", () => {
    mockQueries([], []);
    const { rerender } = render(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);
    expect(screen.queryByText("Recently resolved")).not.toBeInTheDocument();

    mockQueries([], [{ ...OPEN_MISTAKE, status: "resolved", resolvedAt: Date.now() }]);
    rerender(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);
    expect(screen.getByText("Recently resolved")).toBeInTheDocument();
  });

  it("calls markMistakeResolved with the right ids when 'Mark resolved' is clicked", async () => {
    mockQueries([OPEN_MISTAKE], []);
    const user = userEvent.setup();
    render(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);

    await user.click(screen.getByRole("button", { name: "Mark resolved" }));

    expect(markResolvedMock).toHaveBeenCalledWith({ userId: "user1", mistakeId: "m1" });
  });

  it("shows a topic's title via titleByTopicId, falling back to 'Unknown topic'", () => {
    mockQueries([OPEN_MISTAKE], []);
    render(<MistakeList userId={"user1" as never} titleByTopicId={{ topic1: "Closures" }} />);
    expect(screen.getByText("Closures")).toBeInTheDocument();
  });

  it("links each open mistake to a practice session for its own topic, and not resolved ones", () => {
    mockQueries(
      [OPEN_MISTAKE, { ...OPEN_MISTAKE, _id: "m2", topicId: "topic2", description: "Missing await" }],
      [{ ...OPEN_MISTAKE, _id: "m3", topicId: "topic3", status: "resolved", resolvedAt: Date.now() }]
    );
    render(<MistakeList userId={"user1" as never} titleByTopicId={{}} />);

    const links = screen.getAllByRole("link", { name: /Practice this/ });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/practice/topic1", "/practice/topic2"]);
  });
});
