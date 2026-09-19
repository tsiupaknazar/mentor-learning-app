import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectTaskRunner } from "./project-task-runner";
import { track } from "@/lib/analytics/track";

// multi-file-editor.tsx renders CodeMirror, which is out of scope for
// component tests (see the plan's "Out of scope" section) - stubbed so
// this test can exercise ProjectTaskRunner's own state/logic in isolation.
// The stub is one plain textarea per file, seeded from the `files` prop
// (like the real editor, only on mount) and reporting edits via onChange.
vi.mock("./multi-file-editor", () => ({
  MultiFileEditor: ({
    files,
    onChange,
  }: {
    files: Array<{ filename: string; content: string }>;
    onChange: (files: Array<{ filename: string; content: string }>) => void;
  }) => (
    <div data-testid="multi-file-editor-stub">
      {files.map((f) => (
        <textarea
          key={f.filename}
          aria-label={f.filename}
          defaultValue={f.content}
          onChange={(e) =>
            onChange(files.map((x) => ({ filename: x.filename, content: x.filename === f.filename ? e.target.value : x.content })))
          }
        />
      ))}
    </div>
  ),
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
  localStorage.clear();
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

  describe("draft persistence", () => {
    const DRAFT_KEY = "unsparing:draft:project-task:task1";
    const STARTING = [{ filename: "index.html", content: "<h1>Hi</h1>", language: "html" as const }];

    it("restores unsubmitted edits over the starting files after a refresh", async () => {
      const user = userEvent.setup();
      const first = render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} />);

      const box = screen.getByLabelText("index.html");
      await user.clear(box);
      await user.type(box, "<p>my edit</p>");

      first.unmount(); // flushes the debounced save
      render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} />);

      expect(await screen.findByLabelText("index.html")).toHaveValue("<p>my edit</p>");
    });

    it("does not write a draft for untouched starting files", () => {
      const { unmount } = render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} />);
      unmount();
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it("ignores draft entries for files that are no longer part of the task", async () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ v: [{ filename: "gone.js", content: "old" }], t: Date.now() })
      );
      render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} />);
      expect(await screen.findByLabelText("index.html")).toHaveValue("<h1>Hi</h1>");
    });

    it("submits the restored content and drops the draft once the review succeeds", async () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ v: [{ filename: "index.html", content: "<p>restored</p>" }], t: Date.now() })
      );
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ review: { verdict: "approved", summary: "Nice", comments: [] }, taskStatus: "done" }),
          { status: 200 }
        )
      );
      const user = userEvent.setup();
      render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} />);

      await user.click(await screen.findByRole("button", { name: "Submit for review" }));
      await screen.findByText("Nice");

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(body.files).toEqual([{ filename: "index.html", content: "<p>restored</p>" }]);
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
  });

  describe("after a review", () => {
    const STARTING = [{ filename: "index.html", content: "<h1>Hi</h1>", language: "html" as const }];
    const NEXT = { _id: "task2", taskCode: "FE-102", title: "Styling" };

    function reviewResponse(verdict: "approved" | "changes_requested", taskStatus: string) {
      return new Response(
        JSON.stringify({ review: { verdict, summary: "Reviewed", comments: [] }, taskStatus }),
        { status: 200 }
      );
    }

    it("offers the next task once the submission is approved", async () => {
      vi.mocked(fetch).mockResolvedValue(reviewResponse("approved", "done"));
      const user = userEvent.setup();
      render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} nextTask={NEXT} />);

      expect(screen.queryByRole("link", { name: /Next task/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Submit for review" }));

      const link = await screen.findByRole("link", { name: /Next task: FE-102 · Styling/ });
      expect(link).toHaveAttribute("href", "/projects/project1/tasks/task2");
    });

    it("falls back to returning to the project when there is no next task", async () => {
      vi.mocked(fetch).mockResolvedValue(reviewResponse("approved", "done"));
      const user = userEvent.setup();
      render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} nextTask={null} />);

      await user.click(screen.getByRole("button", { name: "Submit for review" }));
      await screen.findByText("Reviewed");

      expect(screen.queryByRole("link", { name: /Next task/ })).not.toBeInTheDocument();
      // The header's own back link plus the new call to action.
      expect(screen.getAllByRole("link", { name: "Back to project" })).toHaveLength(2);
    });

    it("does not offer the next task when changes were requested", async () => {
      vi.mocked(fetch).mockResolvedValue(reviewResponse("changes_requested", "changes_requested"));
      const user = userEvent.setup();
      render(<ProjectTaskRunner {...BASE_PROPS} initialStatus="todo" startingFiles={STARTING} nextTask={NEXT} />);

      await user.click(screen.getByRole("button", { name: "Submit for review" }));
      await screen.findByText("Reviewed");

      expect(screen.queryByRole("link", { name: /Next task/ })).not.toBeInTheDocument();
    });

    it("scrolls the fresh review into view, but not an existing one on first load", async () => {
      const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
      vi.mocked(fetch).mockResolvedValue(reviewResponse("changes_requested", "changes_requested"));
      const user = userEvent.setup();
      render(
        <ProjectTaskRunner
          {...BASE_PROPS}
          initialStatus="changes_requested"
          startingFiles={STARTING}
          pastSubmissions={[
            {
              id: "s1",
              files: [],
              submittedAt: Date.now(),
              review: { verdict: "changes_requested", summary: "Earlier review", comments: [] },
            },
          ]}
        />
      );
      expect(screen.getByText("Earlier review")).toBeInTheDocument();
      expect(scrollSpy).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /Resubmit/ }));
      await screen.findByText("Reviewed");

      expect(scrollSpy).toHaveBeenCalledTimes(1);
      scrollSpy.mockRestore();
    });
  });
});
