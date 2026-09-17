import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectTaskRunner } from "./project-task-runner";
import { track } from "@/lib/analytics/track";

// multi-file-editor.tsx renders CodeMirror, which is out of scope for
// component tests (see the plan's "Out of scope" section) - stubbed so
// this test can exercise ProjectTaskRunner's own state/logic in isolation.
// The submit-disabled check only depends on the `startingFiles` prop, not
// on interacting with the real editor.
vi.mock("./multi-file-editor", () => ({
  MultiFileEditor: () => <div data-testid="multi-file-editor-stub" />,
}));

const BASE_PROPS = {
  projectId: "project1",
  taskId: "task1" as never,
  taskCode: "FE-101",
  taskTitle: "Build the form",
  requirements: ["validates email"],
  pastSubmissions: [],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectTaskRunner", () => {
  it("disables submit when every file is empty or whitespace-only", () => {
    render(
      <ProjectTaskRunner
        {...BASE_PROPS}
        initialStatus="todo"
        startingFiles={[{ filename: "index.html", content: "   ", language: "html" }]}
      />
    );
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  });

  it("enables submit once a file has real content", () => {
    render(
      <ProjectTaskRunner
        {...BASE_PROPS}
        initialStatus="todo"
        startingFiles={[{ filename: "index.html", content: "<h1>Hi</h1>", language: "html" }]}
      />
    );
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeEnabled();
  });

  it("shows 'Resubmit' instead of 'Submit for review' when status is changes_requested", () => {
    render(
      <ProjectTaskRunner
        {...BASE_PROPS}
        initialStatus="changes_requested"
        startingFiles={[{ filename: "index.html", content: "<h1>Hi</h1>", language: "html" }]}
      />
    );
    expect(screen.getByRole("button", { name: /Resubmit/ })).toBeInTheDocument();
  });

  it("submits, shows the returned review, and tracks the event", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          review: { verdict: "approved", summary: "Looks good", comments: [] },
          taskStatus: "done",
        }),
        { status: 200 }
      )
    );
    const user = userEvent.setup();
    render(
      <ProjectTaskRunner
        {...BASE_PROPS}
        initialStatus="todo"
        startingFiles={[{ filename: "index.html", content: "<h1>Hi</h1>", language: "html" }]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => expect(screen.getByText("Looks good")).toBeInTheDocument());
    expect(track).toHaveBeenCalledWith(
      "project_task_reviewed",
      expect.objectContaining({ projectId: "project1", taskCode: "FE-101", verdict: "approved", status: "done" })
    );
  });

  it("only shows the earlier-submissions details with more than one past submission", () => {
    const { rerender } = render(
      <ProjectTaskRunner
        {...BASE_PROPS}
        initialStatus="todo"
        startingFiles={[{ filename: "index.html", content: "<h1>Hi</h1>", language: "html" }]}
        pastSubmissions={[{ id: "s1", files: [], submittedAt: Date.now(), review: null }]}
      />
    );
    expect(screen.queryByText(/earlier submission/)).not.toBeInTheDocument();

    rerender(
      <ProjectTaskRunner
        {...BASE_PROPS}
        initialStatus="todo"
        startingFiles={[{ filename: "index.html", content: "<h1>Hi</h1>", language: "html" }]}
        pastSubmissions={[
          { id: "s1", files: [], submittedAt: Date.now(), review: null },
          { id: "s2", files: [], submittedAt: Date.now(), review: null },
        ]}
      />
    );
    expect(screen.getByText("1 earlier submission")).toBeInTheDocument();
  });
});
