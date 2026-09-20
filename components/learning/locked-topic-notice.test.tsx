import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LockedTopicNotice } from "./locked-topic-notice";

describe("LockedTopicNotice", () => {
  it("names the topic and says it's locked", () => {
    render(<LockedTopicNotice topicTitle="Flexbox" />);
    expect(screen.getByRole("heading", { name: "This topic is locked" })).toBeInTheDocument();
    expect(screen.getByText(/Flexbox — /)).toBeInTheDocument();
  });

  it("links straight to what to finish first", () => {
    render(
      <LockedTopicNotice
        topicTitle="Flexbox"
        blockedBy={[{ _id: "html", title: "HTML structure and semantics" }]}
      />
    );
    expect(screen.getByRole("link", { name: "Go to HTML structure and semantics" })).toHaveAttribute("href", "/learn/html");
  });

  it("offers one link per topic to finish, and skips one whose title couldn't be resolved", () => {
    render(
      <LockedTopicNotice
        topicTitle="Advanced"
        blockedBy={[
          { _id: "a", title: "Basics" },
          { _id: "b", title: "Functions" },
          { _id: "c", title: "" },
        ]}
      />
    );
    expect(screen.getAllByRole("link", { name: /^Go to / })).toHaveLength(2);
  });

  it("defaults to going back to the learning path, and can go elsewhere with context (Practice)", () => {
    const { rerender } = render(<LockedTopicNotice topicTitle="Flexbox" />);
    expect(screen.getByRole("link", { name: "Back to learning path" })).toHaveAttribute("href", "/learn");

    rerender(
      <LockedTopicNotice
        topicTitle="Flexbox"
        backHref="/practice"
        backLabel="Back to practice board"
        note="Practice opens for a topic once you’ve reached it in your learning path."
      />
    );
    expect(screen.getByRole("link", { name: "Back to practice board" })).toHaveAttribute("href", "/practice");
    expect(screen.getByText(/Practice opens for a topic once you’ve reached it/)).toBeInTheDocument();
  });
});
