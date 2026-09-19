import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { NewPathFlow } from "./new-path-flow";

const pushMock = vi.fn();
const completeOnboardingMock = vi.fn();
let pathStatuses: number[];
let pathCalls: number;

beforeEach(() => {
  pathStatuses = [200];
  pathCalls = 0;
  pushMock.mockReset();
  completeOnboardingMock.mockReset().mockResolvedValue(undefined);
  vi.mocked(useMutation).mockReturnValue(completeOnboardingMock as never);
  vi.mocked(useRouter).mockReturnValue({ push: pushMock, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() } as never);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const status = pathStatuses[Math.min(pathCalls++, pathStatuses.length - 1)]!;
      return new Response("{}", { status });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFlow() {
  return render(
    <NewPathFlow
      userId={"user1" as never}
      currentGoal="improve_skills"
      currentStyle="balanced"
      currentTime="30min"
      suggestedTopics={["Node.js"]}
      triedTopics={["JavaScript"]}
    />
  );
}

describe("NewPathFlow", () => {
  it("retries path generation from the error screen and then goes to the dashboard", async () => {
    pathStatuses = [502, 200];
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: "Node.js" })); // suggested topic chip
    await user.click(screen.getByRole("button", { name: /Generate|Start/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate your learning path. Try again.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(pathCalls).toBe(2);
    // The existing goal/style/time are kept, not reset, on each attempt.
    expect(completeOnboardingMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ learningGoal: "improve_skills", learningStyle: "balanced", dailyTime: "30min" })
    );
  });

  it("refuses to start without a topic", async () => {
    const user = userEvent.setup();
    renderFlow();
    // Custom topic selected but left empty.
    await user.click(screen.getAllByRole("combobox")[0]!);
    await user.click(await screen.findByRole("option", { name: /Custom topic/ }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Generate|Start/ }));

    expect(screen.getByText("Enter the topic you want to learn.")).toBeInTheDocument();
    expect(pathCalls).toBe(0);
  });
});
