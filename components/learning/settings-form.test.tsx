import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { useLocale } from "@/lib/i18n/locale-context";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { SettingsForm } from "./settings-form";

const BASE_PROPS = {
  userId: "user1" as never,
  email: "learner@example.com",
  level: "junior" as const,
  learningGoal: "improve_skills" as const,
  learningStyle: "balanced" as const,
  dailyTime: "30min" as const,
};

const updatePreferencesMock = vi.fn();
const setLocaleMock = vi.fn();

beforeEach(() => {
  updatePreferencesMock.mockReset().mockResolvedValue(undefined);
  setLocaleMock.mockReset();
  vi.mocked(useMutation).mockReturnValue(updatePreferencesMock as never);
  vi.mocked(useLocale).mockReturnValue({ t: dictionaries.en, locale: "en", setLocale: setLocaleMock });
});

describe("SettingsForm", () => {
  it("renders the account email and level", () => {
    render(<SettingsForm {...BASE_PROPS} />);
    expect(screen.getByText("learner@example.com")).toBeInTheDocument();
    expect(screen.getByText("junior")).toBeInTheDocument();
  });

  it("saves only the changed field when the learning-goal select changes, and shows the saved checkmark", async () => {
    const user = userEvent.setup();
    render(<SettingsForm {...BASE_PROPS} />);

    // Selects aren't labelled via htmlFor, so query by render order:
    // learning goal, learning style, available time, language.
    const [goalSelect] = screen.getAllByRole("combobox");
    await user.click(goalSelect!);
    await user.click(await screen.findByRole("option", { name: "Prepare for interviews" }));

    expect(updatePreferencesMock).toHaveBeenCalledWith({
      userId: "user1",
      learningGoal: "interview_prep",
    });
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    // Let Radix's Select fully close (its portal/focus-trap teardown is
    // otherwise still in flight when RTL's cleanup() unmounts the tree,
    // which was leaking aria-hidden state onto later tests' comboboxes).
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("calls setLocale when the language select changes, without touching updatePreferences", async () => {
    const user = userEvent.setup();
    render(<SettingsForm {...BASE_PROPS} />);

    const selects = screen.getAllByRole("combobox");
    const languageSelect = selects[selects.length - 1]!;
    await user.click(languageSelect);
    await user.click(await screen.findByRole("option", { name: "Ukrainian" }));

    expect(setLocaleMock).toHaveBeenCalledWith("uk");
    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });
});
