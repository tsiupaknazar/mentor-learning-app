import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation } from "convex/react";
import { PracticeBoard } from "./practice-board";

const TOPIC_A = { _id: "topicA", title: "Closures", orderIndex: 0, progress: { status: "in_progress" } };
const TOPIC_B = { _id: "topicB", title: "Loops", orderIndex: 1, progress: { status: "in_progress" } };

function problem(overrides: Record<string, unknown>) {
  return {
    _id: "p1",
    topicId: "topicA",
    subtopic: "closures",
    type: "debugging",
    difficulty: "easy",
    language: "javascript",
    title: "Fix it",
    prompt: "p",
    contentLocale: "en",
    createdAt: Date.now(),
    status: "unsolved",
    ...overrides,
  };
}

function mockQueries(pathData: unknown, problems: unknown) {
  vi.mocked(useQuery).mockImplementation((_query, args?) => {
    if (args === "skip") return undefined;
    if (args && typeof args === "object" && "topicIds" in args) return problems;
    return pathData;
  });
}

beforeEach(() => {
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PracticeBoard", () => {
  it("shows the no-active-path empty state instead of the board when pathData is null", () => {
    mockQueries(null, undefined);
    render(<PracticeBoard userId={"user1" as never} />);
    expect(
      screen.getByText("Complete onboarding to generate a learning path, then problems will appear here.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Topic")).not.toBeInTheDocument();
  });

  it("filters the visible problems by topic", async () => {
    mockQueries(
      { path: {}, topics: [TOPIC_A, TOPIC_B] },
      [problem({ _id: "p1", topicId: "topicA", title: "Problem A" }), problem({ _id: "p2", topicId: "topicB", title: "Problem B" })]
    );
    const user = userEvent.setup();
    render(<PracticeBoard userId={"user1" as never} />);

    expect(screen.getByText("Problem A")).toBeInTheDocument();
    expect(screen.getByText("Problem B")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Closures" }));

    expect(screen.getByText("Problem A")).toBeInTheDocument();
    expect(screen.queryByText("Problem B")).not.toBeInTheDocument();
  });

  it("filters the visible problems by difficulty", async () => {
    mockQueries(
      { path: {}, topics: [TOPIC_A] },
      [
        problem({ _id: "p1", title: "Easy one", difficulty: "easy" }),
        problem({ _id: "p2", title: "Hard one", difficulty: "hard" }),
      ]
    );
    const user = userEvent.setup();
    render(<PracticeBoard userId={"user1" as never} />);

    await user.click(screen.getByRole("button", { name: "Hard" }));

    expect(screen.queryByText("Easy one")).not.toBeInTheDocument();
    expect(screen.getByText("Hard one")).toBeInTheDocument();
  });

  it("auto-generates a first batch exactly once when the board is genuinely empty", async () => {
    mockQueries({ path: {}, topics: [TOPIC_A] }, []);
    render(<PracticeBoard userId={"user1" as never} />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/practice-problems",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not auto-generate when problems already exist", async () => {
    mockQueries({ path: {}, topics: [TOPIC_A] }, [problem({})]);
    render(<PracticeBoard userId={"user1" as never} />);

    await new Promise((r) => setTimeout(r, 10));
    expect(fetch).not.toHaveBeenCalled();
  });
});
