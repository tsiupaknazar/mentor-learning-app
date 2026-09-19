import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { NewProjectForm } from "./new-project-form";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function ideasResponse(ideas: unknown[]) {
  return new Response(JSON.stringify({ ideas }), { status: 200 });
}

const IDEA = { topic: "React", title: "Kanban board", description: "d" };
const pushMock = vi.fn();

const ideaCalls = () => vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/project/ideas").length;
const startButton = () => screen.getByRole("button", { name: /Start a new project/ });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(useRouter).mockReturnValue({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  } as never);
  pushMock.mockReset();
  // A fresh Response per call: a body can only be read once.
  vi.stubGlobal("fetch", vi.fn(async () => ideasResponse([IDEA])));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NewProjectForm", () => {
  it("starts closed, showing only the start button", () => {
    render(<NewProjectForm defaultLevel="junior" />);
    expect(startButton()).toBeInTheDocument();
    expect(screen.queryByText("Pick a project idea")).not.toBeInTheDocument();
  });

  describe("idea requests", () => {
    it("makes no AI call just because the page loaded", async () => {
      render(<NewProjectForm defaultLevel="junior" />);
      await new Promise((r) => setTimeout(r, 20));
      expect(fetch).not.toHaveBeenCalled();
    });

    it("warms up on hover, so opening shows the ideas instantly with no second request", async () => {
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);

      await user.hover(startButton());
      await waitFor(() => expect(ideaCalls()).toBe(1));
      expect(fetch).toHaveBeenCalledWith(
        "/api/project/ideas",
        expect.objectContaining({ body: JSON.stringify({ level: "junior" }) })
      );

      await user.click(startButton());
      expect(await screen.findByText("Kanban board")).toBeInTheDocument();
      expect(screen.getByText("Pick a project idea")).toBeInTheDocument();
      expect(ideaCalls()).toBe(1);
    });

    it("still works without hovering: opening fetches the ideas itself", async () => {
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);

      await user.click(startButton());

      expect(await screen.findByText("Kanban board")).toBeInTheDocument();
      expect(ideaCalls()).toBe(1);
    });

    it("shares one request between hovering and then clicking while it is still in flight", async () => {
      const pending = deferred<Response>();
      vi.mocked(fetch).mockReturnValueOnce(pending.promise);
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);

      await user.hover(startButton());
      await user.click(startButton());
      expect(ideaCalls()).toBe(1); // not two paid calls for one intent

      pending.resolve(ideasResponse([{ topic: "T", title: "Shared idea", description: "d" }]));
      expect(await screen.findByText("Shared idea")).toBeInTheDocument();
      expect(ideaCalls()).toBe(1);
    });

    it("remembers ideas for a while: a later visit costs no request", async () => {
      const user = userEvent.setup();
      const first = render(<NewProjectForm defaultLevel="junior" />);
      await user.click(startButton());
      await screen.findByText("Kanban board");
      first.unmount();
      vi.mocked(fetch).mockClear();

      render(<NewProjectForm defaultLevel="junior" />);
      await user.hover(startButton());
      await user.click(startButton());

      expect(await screen.findByText("Kanban board")).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps separate ideas per level", async () => {
      const user = userEvent.setup();
      const first = render(<NewProjectForm defaultLevel="junior" />);
      await user.click(startButton());
      await screen.findByText("Kanban board");
      first.unmount();
      vi.mocked(fetch).mockClear();

      render(<NewProjectForm defaultLevel="advanced" />);
      await user.click(startButton());

      await waitFor(() => expect(ideaCalls()).toBe(1)); // junior's cache doesn't serve advanced
      expect(vi.mocked(fetch).mock.calls[0]![1]!.body).toBe(JSON.stringify({ level: "advanced" }));
    });

    it("'New ideas' always fetches a new batch, even when a cached one exists", async () => {
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);
      await user.click(startButton());
      await screen.findByText("Kanban board");
      expect(ideaCalls()).toBe(1);

      vi.mocked(fetch).mockImplementation(async () =>
        ideasResponse([{ topic: "Vue", title: "Fresh idea", description: "d" }])
      );
      await user.click(screen.getByRole("button", { name: "New ideas" }));

      expect(await screen.findByText("Fresh idea")).toBeInTheDocument();
      expect(ideaCalls()).toBe(2);
    });

    it("shows an error, not a stale list, when the ideas can't be fetched", async () => {
      vi.mocked(fetch).mockImplementation(async () => new Response("{}", { status: 502 }));
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);

      await user.click(startButton());

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText("Kanban board")).not.toBeInTheDocument();
    });
  });

  describe("creating a project", () => {
    it("shows a validation error for an empty custom topic", async () => {
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);

      await user.click(startButton());
      await user.click(await screen.findByRole("button", { name: "Or describe your own idea" }));
      await user.click(screen.getByRole("button", { name: "Generate project" }));

      expect(screen.getByText("Enter a topic for the project.")).toBeInTheDocument();
    });

    it("navigates to the new project on success", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(ideasResponse([IDEA]))
        .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project1" }), { status: 200 }));
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);

      await user.click(startButton());
      await user.click(await screen.findByRole("button", { name: "Build this" }));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/projects/project1"));
    });

    it("replaces the form with a progress view while the project is being scoped", async () => {
      const pending = deferred<Response>();
      vi.mocked(fetch).mockResolvedValueOnce(ideasResponse([IDEA])).mockReturnValueOnce(pending.promise);
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);
      await user.click(startButton());

      await user.click(await screen.findByRole("button", { name: "Build this" }));

      // One clear progress message - not a spinner on every "Build this" card.
      expect(screen.getByRole("status")).toHaveTextContent("Scoping tasks…");
      expect(screen.queryByRole("button", { name: "Build this" })).not.toBeInTheDocument();
      expect(screen.queryByText("Kanban board")).not.toBeInTheDocument();
    });

    it("returns to the ideas with the error shown if scoping fails, so the learner can try another", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(ideasResponse([IDEA]))
        .mockResolvedValueOnce(new Response("{}", { status: 502 }));
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);
      await user.click(startButton());
      await user.click(await screen.findByRole("button", { name: "Build this" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("The AI service is having trouble right now.");
      expect(screen.getByText("Kanban board")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Build this" })).toBeEnabled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("keeps a typed custom topic when generating it fails", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(ideasResponse([]))
        .mockResolvedValueOnce(new Response("{}", { status: 500 }));
      const user = userEvent.setup();
      render(<NewProjectForm defaultLevel="junior" />);
      await user.click(startButton());
      await user.click(await screen.findByRole("button", { name: "Or describe your own idea" }));
      await user.type(screen.getByRole("textbox"), "A chess clock");

      await user.click(screen.getByRole("button", { name: "Generate project" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("A chess clock");
    });
  });
});
