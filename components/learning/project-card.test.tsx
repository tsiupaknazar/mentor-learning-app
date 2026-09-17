import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./project-card";

const BASE_PROJECT = {
  _id: "project1",
  title: "Kanban board",
  description: "A drag-and-drop kanban board.",
  level: "junior",
  contentLocale: "en" as const,
};

describe("ProjectCard", () => {
  it("links to the project's detail page", () => {
    render(
      <ProjectCard project={{ ...BASE_PROJECT, status: "in_progress" }} taskCount={4} doneCount={1} />
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/project1");
  });

  it.each([
    ["not_started", "not started"],
    ["in_progress", "in progress"],
    ["completed", "completed"],
  ] as const)("shows the %s status label", (status, label) => {
    render(<ProjectCard project={{ ...BASE_PROJECT, status }} taskCount={4} doneCount={1} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders the title and description", () => {
    render(
      <ProjectCard project={{ ...BASE_PROJECT, status: "not_started" }} taskCount={4} doneCount={0} />
    );
    expect(screen.getByText("Kanban board")).toBeInTheDocument();
    expect(screen.getByText("A drag-and-drop kanban board.")).toBeInTheDocument();
  });
});
