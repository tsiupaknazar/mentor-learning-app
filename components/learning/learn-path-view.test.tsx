import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LearnPathView, type LearnTopicRow } from "./learn-path-view";

const PATH = { title: "JS Path", rationale: "Because you're learning JavaScript." };

function topic(overrides: Partial<LearnTopicRow>): LearnTopicRow {
  return {
    _id: "t1",
    externalId: "closures",
    title: "Closures",
    summary: "Closures summary",
    orderIndex: 0,
    prerequisiteExternalIds: [],
    locked: false,
    progress: null,
    ...overrides,
  };
}

describe("LearnPathView", () => {
  it("renders an unlocked, not-started topic as a real link with a 'not started' badge", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[topic({ _id: "t1" })]}
      />
    );

    const link = screen.getByRole("link", { name: /Closures/ });
    expect(link).toHaveAttribute("href", "/learn/t1");
    expect(screen.getByText("not started")).toBeInTheDocument();
  });

  it("renders a locked topic as a non-clickable block naming its prerequisite by title, not raw id", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[
          topic({ _id: "t1", externalId: "functions", title: "Functions", summary: "Functions summary" }),
          topic({
            _id: "t2",
            externalId: "closures",
            title: "Closures",
            locked: true,
            prerequisiteExternalIds: ["functions"],
          }),
        ]}
      />
    );

    expect(screen.queryByRole("link", { name: /Closures/ })).not.toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    // The prerequisite is named by its title (never the raw id "functions")...
    expect(screen.getByText(/Requires:/)).toBeInTheDocument();
    expect(screen.queryByText(/\bfunctions\b/)).not.toBeInTheDocument();
    // ...and, being startable, is a link straight to it.
    expect(screen.getByRole("link", { name: "Functions" })).toHaveAttribute("href", "/learn/t1");
  });

  it("shows a mastery percentage badge for a topic with progress instead of 'not started'", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[
          topic({
            progress: { mastery: { overall: 72 }, status: "in_progress", attemptsCount: 3 },
          }),
        ]}
      />
    );

    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.queryByText("not started")).not.toBeInTheDocument();
  });

  it("renders every level of a three-level topic tree, not just root and children", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[
          topic({ _id: "root", externalId: "js", title: "JavaScript Basics", summary: "s1" }),
          topic({ _id: "child", externalId: "fn", title: "Functions", summary: "s2", parentTopicId: "root" }),
          topic({ _id: "grand", externalId: "clos", title: "Closures", summary: "s3", parentTopicId: "child" }),
        ]}
      />
    );

    expect(screen.getByRole("link", { name: /JavaScript Basics/ })).toHaveAttribute("href", "/learn/root");
    expect(screen.getByRole("link", { name: /Functions/ })).toHaveAttribute("href", "/learn/child");
    // Previously dropped: grandchildren were handed an empty children list.
    expect(screen.getByRole("link", { name: /Closures/ })).toHaveAttribute("href", "/learn/grand");
  });

  it("links 'Start a new topic' to /learn/new", () => {
    render(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[]} />);
    expect(screen.getByRole("link", { name: "Start a new topic" })).toHaveAttribute("href", "/learn/new");
  });

  it("does not link a prerequisite that is itself still locked", () => {
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[
          topic({ _id: "t1", externalId: "basics", title: "Basics", locked: true, prerequisiteExternalIds: ["intro"] }),
          topic({ _id: "t2", externalId: "intro", title: "Intro", locked: false }),
          topic({ _id: "t3", externalId: "advanced", title: "Advanced", locked: true, prerequisiteExternalIds: ["basics"] }),
        ]}
      />
    );

    // "Basics" is a prerequisite of Advanced, but can't be started yet: named, not linked.
    expect(screen.queryByRole("link", { name: "Basics" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Basics").length).toBeGreaterThan(0);
    // "Intro" is startable, so Basics' own requirement links to it.
    expect(screen.getByRole("link", { name: "Intro" })).toHaveAttribute("href", "/learn/t2");
  });

  it("marks the suggested topic as 'Up next' - but never a locked one", () => {
    const topics = [
      topic({ _id: "t1", externalId: "a", title: "Alpha" }),
      topic({ _id: "t2", externalId: "b", title: "Beta", locked: true, prerequisiteExternalIds: ["a"] }),
    ];
    const { rerender } = render(
      <LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={topics} nextTopicId="t1" />
    );
    expect(screen.getAllByText("Up next")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Alpha.*Up next/ })).toBeInTheDocument();

    rerender(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={topics} nextTopicId="t2" />);
    expect(screen.queryByText("Up next")).not.toBeInTheDocument();

    rerender(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={topics} />);
    expect(screen.queryByText("Up next")).not.toBeInTheDocument();
  });

  it("shows overall progress as completed topics out of all topics", () => {
    const mastered = { mastery: { overall: 90 }, status: "mastered" as const, attemptsCount: 4 };
    render(
      <LearnPathView
        learningPathId="path1"
        contentLocale="en"
        path={PATH}
        topics={[
          topic({ _id: "t1", externalId: "a", title: "A", progress: mastered }),
          topic({ _id: "t2", externalId: "b", title: "B", progress: mastered }),
          topic({ _id: "t3", externalId: "c", title: "C" }),
          topic({ _id: "t4", externalId: "d", title: "D" }),
        ]}
      />
    );

    expect(screen.getByText("2 of 4 topics completed")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "2 of 4 topics completed" })).toBeInTheDocument();
  });

  it("shows no progress line for an empty path", () => {
    render(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[]} />);
    expect(screen.queryByText(/topics completed/)).not.toBeInTheDocument();
  });

  describe("the path's own order", () => {
    const html = topic({ _id: "html", externalId: "html", title: "HTML structure and semantics", orderIndex: 0 });
    const selectors = topic({
      _id: "sel",
      externalId: "selectors",
      title: "CSS selectors",
      orderIndex: 1,
      locked: true,
      block: "order",
      blockedBy: ["html"],
    });
    const flexbox = topic({
      _id: "flex",
      externalId: "flexbox",
      title: "Flexbox",
      orderIndex: 2,
      locked: true,
      block: "order",
      blockedBy: ["html"],
    });

    it("tells a topic that's ahead what to finish first, and links straight to it", () => {
      render(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[html, selectors, flexbox]} />);

      const notes = screen.getAllByText(/Finish first:/);
      expect(notes).toHaveLength(2); // Selectors and Flexbox
      expect(screen.queryByText(/Requires:/)).not.toBeInTheDocument();
      // Both point at the ONE topic to do next, HTML - and it's a link, since HTML is open.
      const links = screen.getAllByRole("link", { name: "HTML structure and semantics" });
      expect(links.some((a) => a.getAttribute("href") === "/learn/html")).toBe(true);
    });

    it("uses 'Requires' for a prerequisite the AI named, and 'Finish first' for path order", () => {
      const prereq = topic({
        _id: "adv",
        externalId: "adv",
        title: "Advanced",
        orderIndex: 3,
        locked: true,
        block: "prerequisites",
        blockedBy: ["html"],
      });
      render(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[html, selectors, prereq]} />);
      expect(screen.getAllByText(/Finish first:/)).toHaveLength(1);
      expect(screen.getAllByText(/Requires:/)).toHaveLength(1);
    });

    it("explains the ordering to a learner on a strict path, and only to them", () => {
      const { rerender } = render(
        <LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[html, selectors]} strictOrder />
      );
      expect(screen.getByText(/opens one topic at a time, in order/)).toBeInTheDocument();

      rerender(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[html, selectors]} />);
      expect(screen.queryByText(/opens one topic at a time/)).not.toBeInTheDocument();
    });

    it("counts a topic learned but not yet mastered as completed", () => {
      render(
        <LearnPathView
          learningPathId="path1"
          contentLocale="en"
          path={PATH}
          topics={[{ ...html, passed: true }, { ...selectors, locked: false, block: null, blockedBy: [], passed: false }]}
        />
      );
      expect(screen.getByText("1 of 2 topics completed")).toBeInTheDocument();
    });

    it("leaves free-form practice topics out of the path, and out of the count", () => {
      const custom = topic({ _id: "custom", externalId: "css-grid", title: "CSS Grid layouts", orderIndex: 9, adHoc: true });
      render(<LearnPathView learningPathId="path1" contentLocale="en" path={PATH} topics={[html, custom]} />);

      expect(screen.queryByText("CSS Grid layouts")).not.toBeInTheDocument();
      expect(screen.getByText("0 of 1 topics completed")).toBeInTheDocument();
    });
  });
});
