import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectDetailView } from "./project-detail-view";

const PROJECT = {
  _id: "project1",
  topic: "JavaScript",
  title: "Kanban board",
  description: "A drag-and-drop kanban board.",
  level: "junior",
  contentLocale: "en" as const,
};

describe("ProjectDetailView", () => {
  it.each([
    ["todo", "To do"],
    ["in_review", "In review"],
    ["changes_requested", "Changes requested"],
    ["done", "Done"],
  ] as const)("shows the %s task status label", (status, label) => {
    render(
      <ProjectDetailView
        project={PROJECT}
        tasks={[{ _id: "task1", taskCode: "FE-101", title: "Build the header", status }]}
      />
    );
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("links each task to its own page", () => {
    render(
      <ProjectDetailView
        project={PROJECT}
        tasks={[{ _id: "task1", taskCode: "FE-101", title: "Build the header", status: "todo" }]}
      />
    );
    const links = screen.getAllByRole("link");
    const taskLink = links.find((l) => l.getAttribute("href")?.includes("/tasks/"));
    expect(taskLink).toHaveAttribute("href", "/projects/project1/tasks/task1");
  });

  it("renders every task's code and title", () => {
    render(
      <ProjectDetailView
        project={PROJECT}
        tasks={[
          { _id: "t1", taskCode: "FE-101", title: "Build the header", status: "todo" },
          { _id: "t2", taskCode: "FE-102", title: "Style the footer", status: "done" },
        ]}
      />
    );
    expect(screen.getByText("FE-101")).toBeInTheDocument();
    expect(screen.getByText("Build the header")).toBeInTheDocument();
    expect(screen.getByText("FE-102")).toBeInTheDocument();
    expect(screen.getByText("Style the footer")).toBeInTheDocument();
  });
});
