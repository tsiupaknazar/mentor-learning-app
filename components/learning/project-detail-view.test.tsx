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

  describe("progress and what to do next", () => {
    const tasks = [
      { _id: "t1", taskCode: "FE-101", title: "Header", status: "done" as const },
      { _id: "t2", taskCode: "FE-102", title: "Columns", status: "changes_requested" as const },
      { _id: "t3", taskCode: "FE-103", title: "Drag and drop", status: "todo" as const },
    ];

    it("shows how many tasks are approved", () => {
      render(<ProjectDetailView project={PROJECT} tasks={tasks} />);
      expect(screen.getByText("1 / 3 tasks")).toBeInTheDocument();
      expect(screen.getByRole("progressbar", { name: "1 / 3 tasks" })).toBeInTheDocument();
    });

    it("offers to continue with the first task that isn't approved yet", () => {
      render(<ProjectDetailView project={PROJECT} tasks={tasks} />);
      expect(screen.getByRole("link", { name: /Continue with FE-102/ })).toHaveAttribute(
        "href",
        "/projects/project1/tasks/t2"
      );
    });

    it("marks only that task as 'Up next'", () => {
      render(<ProjectDetailView project={PROJECT} tasks={tasks} />);
      expect(screen.getAllByText("Up next")).toHaveLength(1);
      expect(screen.getByRole("link", { name: /FE-102.*Up next/ })).toBeInTheDocument();
    });

    it("says the work is finished, instead of offering a next task, once every task is approved", () => {
      render(
        <ProjectDetailView project={PROJECT} tasks={tasks.map((tk) => ({ ...tk, status: "done" as const }))} />
      );
      expect(screen.getByText("3 / 3 tasks")).toBeInTheDocument();
      expect(screen.getByText("All tasks approved")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Continue with/ })).not.toBeInTheDocument();
      expect(screen.queryByText("Up next")).not.toBeInTheDocument();
    });

    it("shows no progress for a project without tasks", () => {
      render(<ProjectDetailView project={PROJECT} tasks={[]} />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByText("All tasks approved")).not.toBeInTheDocument();
    });

    it("shows the level in the learner's language", () => {
      render(<ProjectDetailView project={PROJECT} tasks={[]} />);
      expect(screen.getByText("Junior")).toBeInTheDocument();
    });
  });
});
