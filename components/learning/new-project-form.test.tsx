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

const pushMock = vi.fn();

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  } as never);
  pushMock.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ideasResponse([])));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NewProjectForm", () => {
  it("starts closed, showing only the start button", () => {
    render(<NewProjectForm defaultLevel="junior" />);
    expect(screen.getByRole("button", { name: /Start a new project/ })).toBeInTheDocument();
    expect(screen.queryByText("Pick a project idea")).not.toBeInTheDocument();
  });

  it("prefetches ideas in the background on mount, before the form is even opened", async () => {
    render(<NewProjectForm defaultLevel="junior" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/project/ideas",
      expect.objectContaining({ body: JSON.stringify({ level: "junior" }) })
    );
  });

  it("opens directly into the ideas view, showing prefetched ideas instantly", async () => {
    vi.mocked(fetch).mockResolvedValue(ideasResponse([{ topic: "React", title: "Kanban board", description: "d" }]));
    const user = userEvent.setup();
    render(<NewProjectForm defaultLevel="junior" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Start a new project/ }));

    expect(screen.getByText("Pick a project idea")).toBeInTheDocument();
    expect(screen.getByText("Kanban board")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1); // no extra fetch - already warm
  });

  it("does not let an older, slower fetch clobber a newer one's result", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const user = userEvent.setup();
    render(<NewProjectForm defaultLevel="junior" />); // triggers the first (prefetch) fetch

    await user.click(screen.getByRole("button", { name: /Start a new project/ })); // triggers the second

    // Resolve the newer request first, then the stale older one.
    second.resolve(ideasResponse([{ topic: "T", title: "Newer idea", description: "d" }]));
    await waitFor(() => expect(screen.getByText("Newer idea")).toBeInTheDocument());

    first.resolve(ideasResponse([{ topic: "T", title: "Stale idea", description: "d" }]));
    await new Promise((r) => setTimeout(r, 10));

    expect(screen.getByText("Newer idea")).toBeInTheDocument();
    expect(screen.queryByText("Stale idea")).not.toBeInTheDocument();
  });

  it("shows a validation error for an empty custom topic, and clears it once one is typed", async () => {
    const user = userEvent.setup();
    render(<NewProjectForm defaultLevel="junior" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Start a new project/ }));
    await user.click(screen.getByRole("button", { name: "Or describe your own idea" }));
    await user.click(screen.getByRole("button", { name: "Generate project" }));

    expect(screen.getByText("Enter a topic for the project.")).toBeInTheDocument();
  });

  it("navigates to the new project on a successful generate", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ideasResponse([{ topic: "React", title: "Kanban board", description: "d" }]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project1" }), { status: 200 }));
    const user = userEvent.setup();
    render(<NewProjectForm defaultLevel="junior" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Start a new project/ }));
    await user.click(screen.getByRole("button", { name: "Build this" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/projects/project1"));
  });
});
