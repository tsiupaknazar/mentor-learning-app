import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { OnboardingFlow } from "./onboarding-flow";

const DIAGNOSTIC = {
  topic: "JavaScript",
  questions: [
    {
      id: "q1",
      type: "knowledge",
      subtopic: "Variables",
      prompt: "Which keyword declares a constant?",
      codeSnippet: null,
      choices: ["let", "const", "var"],
    },
    {
      id: "q2",
      type: "explanation",
      subtopic: "Scope",
      prompt: "Explain what a closure captures.",
      codeSnippet: null,
      choices: null,
    },
  ],
};
const PROFILE = { topic: "JavaScript", subtopics: [], suggestedLevel: "junior", summary: "ok" };

const pushMock = vi.fn();
const completeOnboardingMock = vi.fn();

// Each endpoint plays its scripted statuses in order, then keeps repeating the last.
let statuses: Record<string, number[]>;
let calls: Record<string, number>;

function respond(url: string) {
  const list = statuses[url] ?? [200];
  const status = list[Math.min(calls[url] ?? 0, list.length - 1)]!;
  calls[url] = (calls[url] ?? 0) + 1;
  if (status !== 200) return new Response("{}", { status });
  const body =
    url === "/api/diagnostic/questions"
      ? { diagnostic: DIAGNOSTIC }
      : url === "/api/diagnostic/evaluate"
        ? { profile: PROFILE }
        : { ok: true };
  return new Response(JSON.stringify(body), { status: 200 });
}

const bodyOf = (url: string, n = 0) =>
  JSON.parse(vi.mocked(fetch).mock.calls.filter(([u]) => u === url)[n]![1]!.body as string);

beforeEach(() => {
  statuses = {};
  calls = {};
  pushMock.mockReset();
  completeOnboardingMock.mockReset().mockResolvedValue(undefined);
  vi.mocked(useMutation).mockReturnValue(completeOnboardingMock as never);
  vi.mocked(useRouter).mockReturnValue({ push: pushMock, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() } as never);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => respond(url)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function pickNotSure(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("combobox")[1]!); // level
  await user.click(await screen.findByRole("option", { name: /not sure/ }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

describe("OnboardingFlow failure recovery", () => {
  it("retries only path generation when it fails, without redoing anything else", async () => {
    statuses["/api/learning-path"] = [502, 200];
    const user = userEvent.setup();
    render(<OnboardingFlow userId={"user1" as never} />);

    await user.click(screen.getByRole("button", { name: "Generate my learning path" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI service is having trouble right now. Try again in a moment.");
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(calls["/api/learning-path"]).toBe(2);
    expect(bodyOf("/api/learning-path", 1)).toEqual(bodyOf("/api/learning-path", 0));
    expect(completeOnboardingMock).toHaveBeenCalledTimes(2);
    expect(completeOnboardingMock.mock.calls[1]![0]).toMatchObject({ level: "beginner" });
  });

  it("'Back' from the path-generation error returns to the form", async () => {
    statuses["/api/learning-path"] = [502];
    const user = userEvent.setup();
    render(<OnboardingFlow userId={"user1" as never} />);
    await user.click(screen.getByRole("button", { name: "Generate my learning path" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("button", { name: "Generate my learning path" })).toBeInTheDocument();
  });

  it("keeps the learner's answers when scoring the diagnostic fails, and reuses the same questions on retry", async () => {
    statuses["/api/diagnostic/evaluate"] = [502, 200];
    const user = userEvent.setup();
    render(<OnboardingFlow userId={"user1" as never} />);
    await pickNotSure(user);

    await user.click(screen.getByRole("button", { name: "Start diagnostic" }));
    await user.click(await screen.findByRole("radio", { name: "const" }));
    await user.type(screen.getByRole("textbox", { name: "Q2" }), "It captures its scope.");
    await user.click(screen.getByRole("button", { name: "Submit diagnostic" }));

    // Back on the same questions - not a blank form - with answers and the error.
    expect(await screen.findByRole("alert")).toHaveTextContent("The AI service is having trouble right now. Try again in a moment.");
    expect(screen.getByRole("radio", { name: "const" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Q2" })).toHaveValue("It captures its scope.");

    await user.click(screen.getByRole("button", { name: "Submit diagnostic" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(calls["/api/diagnostic/questions"]).toBe(1); // never regenerated
    expect(calls["/api/diagnostic/evaluate"]).toBe(2);
    expect(bodyOf("/api/diagnostic/evaluate", 1).answers.map((a: { answer: string }) => a.answer)).toEqual([
      "const",
      "It captures its scope.",
    ]);
    expect(completeOnboardingMock.mock.calls[0]![0]).toMatchObject({ level: "junior" });
    expect(bodyOf("/api/learning-path").knowledgeProfile).toEqual(PROFILE);
  });

  it("returns to the form with the error when the diagnostic can't be generated", async () => {
    statuses["/api/diagnostic/questions"] = [502];
    const user = userEvent.setup();
    render(<OnboardingFlow userId={"user1" as never} />);
    await pickNotSure(user);

    await user.click(screen.getByRole("button", { name: "Start diagnostic" }));

    expect(await screen.findByText("The AI service is having trouble right now. Try again in a moment.")).toBeInTheDocument();
    // Selections survive: still on the "not sure" flow, ready to try again.
    expect(screen.getByRole("button", { name: "Start diagnostic" })).toBeInTheDocument();
  });
});

describe("OnboardingFlow error wording", () => {
  it("uses the feature's own message for an unclassified server error, and advice for a known cause", async () => {
    statuses["/api/learning-path"] = [500];
    const user = userEvent.setup();
    const { unmount } = render(<OnboardingFlow userId={"user1" as never} />);
    await user.click(screen.getByRole("button", { name: "Generate my learning path" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate your learning path. Try again.");
    unmount();

    statuses["/api/learning-path"] = [401];
    calls = {};
    render(<OnboardingFlow userId={"user1" as never} />);
    await user.click(screen.getByRole("button", { name: "Generate my learning path" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired. Reload the page to sign in again.");
  });
});

describe("OnboardingFlow form", () => {
  it("asks for topic and level first, with the preferences collapsed behind a summary of the defaults", () => {
    render(<OnboardingFlow userId={"user1" as never} />);

    // Only topic + level are shown as selects until preferences are opened.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    const toggle = screen.getByRole("button", { name: /Personalize/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("Improve existing skills · Balanced · 30 min / day");
  });

  it("reveals goal, style and time on demand, and sends the changed choice", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow userId={"user1" as never} />);

    await user.click(screen.getByRole("button", { name: /Personalize/ }));
    expect(screen.getByRole("button", { name: /Personalize/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("combobox")).toHaveLength(5);

    // Order in the DOM: topic, level, goal, style, time.
    await user.click(screen.getAllByRole("combobox")[2]!);
    await user.click(await screen.findByRole("option", { name: "Prepare for interviews" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Personalize/ })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Generate my learning path" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(completeOnboardingMock.mock.calls[0]![0]).toMatchObject({
      learningGoal: "interview_prep",
      learningStyle: "balanced",
      dailyTime: "30min",
    });
  });

  it("still works untouched: the defaults are submitted as they are", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow userId={"user1" as never} />);

    await user.click(screen.getByRole("button", { name: "Generate my learning path" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(completeOnboardingMock.mock.calls[0]![0]).toMatchObject({
      level: "beginner",
      learningGoal: "improve_skills",
      learningStyle: "balanced",
      dailyTime: "30min",
    });
    expect(bodyOf("/api/learning-path").topic).toBe("JavaScript");
  });
});
