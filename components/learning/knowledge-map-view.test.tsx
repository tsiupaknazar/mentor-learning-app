import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { KnowledgeMapView, type KnowledgeTopic } from "./knowledge-map-view";

const NOW = Date.parse("2024-06-12T12:00:00Z");

const skills = (over: Record<string, number> = {}) => ({
  knowledge: 80,
  application: 80,
  debugging: 80,
  explanation: 80,
  retention: 50,
  overall: 75,
  ...over,
});

function topic(over: Partial<KnowledgeTopic> & { _id: string; title: string }): KnowledgeTopic {
  return {
    externalId: over._id,
    orderIndex: 0,
    locked: false,
    progress: null,
    ...over,
  };
}

const progress = (over: Partial<NonNullable<KnowledgeTopic["progress"]>> = {}) => ({
  mastery: skills(),
  status: "in_progress",
  attemptsCount: 3,
  ...over,
});

function renderMap(topics: KnowledgeTopic[]) {
  return render(
    <KnowledgeMapView learningPathId="path1" contentLocale="en" pathTitle="JS Path" topics={topics} nowMs={NOW} />
  );
}

describe("KnowledgeMapView", () => {
  it("lists topics in learning-path order, not database order", () => {
    renderMap([
      topic({ _id: "b", title: "Second", orderIndex: 1 }),
      topic({ _id: "a", title: "First", orderIndex: 0 }),
    ]);
    const names = screen.getAllByText(/^(First|Second)$/).map((el) => el.textContent);
    expect(names).toEqual(["First", "Second"]);
  });

  it("indents sub-topics under their parent, right after it", () => {
    renderMap([
      topic({ _id: "r2", title: "Root Two", orderIndex: 1 }),
      topic({ _id: "c", title: "Child", orderIndex: 0, parentTopicId: "r1" }),
      topic({ _id: "r1", title: "Root One", orderIndex: 0 }),
    ]);

    const order = screen.getAllByText(/^(Root One|Child|Root Two)$/).map((el) => el.textContent);
    expect(order).toEqual(["Root One", "Child", "Root Two"]);

    const marginOf = (title: string) => {
      let el: HTMLElement | null = screen.getByText(title);
      while (el && !el.style.marginLeft) el = el.parentElement;
      return el?.style.marginLeft ?? "0px";
    };
    expect(marginOf("Root One")).toBe("0px");
    expect(marginOf("Child")).toBe("16px");
  });

  it("links an unlocked topic to its lesson", () => {
    renderMap([topic({ _id: "t1", title: "Closures", progress: progress() })]);
    expect(screen.getByRole("link", { name: "Closures" })).toHaveAttribute("href", "/learn/t1");
  });

  it("shows a locked topic as locked, not as a link, with no practice suggestion", () => {
    renderMap([
      topic({
        _id: "t1",
        title: "Advanced",
        locked: true,
        progress: progress({ mastery: skills({ debugging: 5 }) }),
      }),
    ]);
    expect(screen.queryByRole("link", { name: "Advanced" })).not.toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Practice this/ })).not.toBeInTheDocument();
  });

  it("flags a topic whose review is due, but not one that is mastered or not yet due", () => {
    renderMap([
      topic({ _id: "due", title: "Due", orderIndex: 0, progress: progress({ nextReviewDue: NOW - 1000 }) }),
      topic({ _id: "later", title: "Later", orderIndex: 1, progress: progress({ nextReviewDue: NOW + 86_400_000 }) }),
      topic({
        _id: "done",
        title: "Done",
        orderIndex: 2,
        progress: progress({ status: "mastered", nextReviewDue: NOW - 1000 }),
      }),
    ]);
    expect(screen.getAllByText("Review due")).toHaveLength(1);
    expect(within(screen.getByText("Due").parentElement!).getByText("Review due")).toBeInTheDocument();
  });

  it("names a genuinely weak skill and links straight into practising that topic", () => {
    renderMap([
      topic({ _id: "t1", title: "Closures", progress: progress({ mastery: skills({ debugging: 20, overall: 60 }) }) }),
    ]);
    expect(screen.getByText("Weakest: Debugging (20%)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Practice this/ })).toHaveAttribute("href", "/practice/t1");
  });

  it("does not nag about a topic whose skills are all reasonable, or one that hasn't been tried", () => {
    renderMap([
      topic({ _id: "ok", title: "Fine", orderIndex: 0, progress: progress() }),
      topic({
        _id: "new",
        title: "Untried",
        orderIndex: 1,
        progress: progress({ attemptsCount: 0, mastery: skills({ knowledge: 0, application: 0, debugging: 0, explanation: 0, overall: 0 }) }),
      }),
    ]);
    expect(screen.queryByText(/Weakest:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Practice this/ })).not.toBeInTheDocument();
  });

  it("says a topic without progress hasn't been attempted", () => {
    renderMap([topic({ _id: "t1", title: "Fresh" })]);
    expect(screen.getByText("Not attempted yet.")).toBeInTheDocument();
  });

  it("gives every skill bar an accessible name and value", () => {
    renderMap([topic({ _id: "t1", title: "Closures", progress: progress({ mastery: skills({ knowledge: 64 }) }) })]);
    expect(screen.getByRole("progressbar", { name: /Knowledge 64%/ })).toBeInTheDocument();
  });

  it("shows the path title", () => {
    renderMap([]);
    expect(screen.getByRole("heading", { name: "JS Path" })).toBeInTheDocument();
  });
});
