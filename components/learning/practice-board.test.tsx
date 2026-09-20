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

  describe("locked topics", () => {
    const LOCKED_B = { ...TOPIC_B, locked: true };

    it("spends the auto-generated batch on topics the learner can start, not locked ones", async () => {
      mockQueries({ path: {}, topics: [LOCKED_B, TOPIC_A] }, []);
      render(<PracticeBoard userId={"user1" as never} />);

      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(body.topicIds).toEqual(["topicA"]);
    });

    it("generates nothing when every topic is blocked, rather than asking for problems the server would refuse", async () => {
      mockQueries({ path: {}, topics: [{ ...TOPIC_A, locked: true }, LOCKED_B] }, []);
      render(<PracticeBoard userId={"user1" as never} />);

      await new Promise((r) => setTimeout(r, 20));
      expect(fetch).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /Generate more problems/ })).toBeDisabled();
    });

    it("hides problems whose topic hasn't been reached, and says how many", () => {
      mockQueries(
        { path: {}, topics: [TOPIC_A, LOCKED_B] },
        [
          problem({ _id: "p1", topicId: "topicA", title: "Open problem" }),
          problem({ _id: "p2", topicId: "topicB", title: "Blocked problem" }),
          problem({ _id: "p3", topicId: "topicB", title: "Another blocked one" }),
        ]
      );
      render(<PracticeBoard userId={"user1" as never} />);

      expect(screen.getByText("Open problem")).toBeInTheDocument();
      expect(screen.queryByText("Blocked problem")).not.toBeInTheDocument();
      expect(screen.getByText(/2 problems are hidden until you reach their topics/)).toBeInTheDocument();
    });

    it("explains an otherwise empty board when everything on it is for unreached topics, and still generates for reachable ones", async () => {
      mockQueries({ path: {}, topics: [TOPIC_A, LOCKED_B] }, [problem({ _id: "p2", topicId: "topicB", title: "Blocked problem" })]);
      render(<PracticeBoard userId={"user1" as never} />);

      // Nothing openable on the board, so a first batch is generated - for the topic that IS open.
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(/1 problem is hidden until you reach its topic/)).toBeInTheDocument();
      expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string).topicIds).toEqual(["topicA"]);
    });

    it("never picks a free-form practice topic for the automatic batch", async () => {
      const CUSTOM = { _id: "custom", title: "CSS Grid layouts", orderIndex: 0, adHoc: true, progress: { status: "in_progress" } };
      mockQueries({ path: {}, topics: [CUSTOM, TOPIC_A] }, []);
      render(<PracticeBoard userId={"user1" as never} />);

      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string).topicIds).toEqual(["topicA"]);
    });

    it("refuses 'add a topic' when the title names a topic of the path that hasn't been reached, and generates nothing", async () => {
      mockQueries({ path: {}, topics: [TOPIC_A, LOCKED_B] }, [problem({})]);
      vi.mocked(useMutation).mockReturnValue(vi.fn().mockResolvedValue("topicB") as never);
      const user = userEvent.setup();
      render(<PracticeBoard userId={"user1" as never} />);

      await user.type(screen.getByRole("textbox"), "Loops");
      await user.click(screen.getByRole("button", { name: /Add/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/haven.t reached it yet/);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("still lets the learner add a genuinely new practice topic", async () => {
      mockQueries({ path: {}, topics: [TOPIC_A] }, [problem({})]);
      vi.mocked(useMutation).mockReturnValue(vi.fn().mockResolvedValue("brand-new") as never);
      const user = userEvent.setup();
      render(<PracticeBoard userId={"user1" as never} />);

      await user.type(screen.getByRole("textbox"), "CSS Grid layouts");
      await user.click(screen.getByRole("button", { name: /Add/ }));

      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string).topicIds).toEqual(["brand-new"]);
    });

    it("labels locked topics in the topic filter", async () => {
      mockQueries({ path: {}, topics: [TOPIC_A, LOCKED_B] }, [problem({})]);
      const user = userEvent.setup();
      render(<PracticeBoard userId={"user1" as never} />);

      await user.click(screen.getByRole("combobox"));

      expect(await screen.findByRole("option", { name: "Loops · Locked" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Closures" })).toBeInTheDocument();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    });
  });

  it("reports why generating problems failed, using the specific cause when there is one", async () => {
    mockQueries({ path: {}, topics: [TOPIC_A] }, [problem({})]);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 }));
    const user = userEvent.setup();
    render(<PracticeBoard userId={"user1" as never} />);

    await user.click(screen.getByRole("button", { name: /Generate more problems/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired. Reload the page to sign in again.");
  });

  it("falls back to the board's own message for an unclassified failure", async () => {
    mockQueries({ path: {}, topics: [TOPIC_A] }, [problem({})]);
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    const user = userEvent.setup();
    render(<PracticeBoard userId={"user1" as never} />);

    await user.click(screen.getByRole("button", { name: /Generate more problems/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate problems for that topic. Try again.");
  });
});
