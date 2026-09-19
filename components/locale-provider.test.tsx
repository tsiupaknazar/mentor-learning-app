import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useMutation } from "convex/react";

// The component test setup replaces this module with a stub; this file tests the real one.
const { LocaleProvider, useLocale } = await vi.importActual<typeof import("@/lib/i18n/locale-context")>("@/lib/i18n/locale-context");

const updatePreferencesMock = vi.fn();

function Probe() {
  const { locale, setLocale } = useLocale();
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale("uk")}>to uk</button>
    </>
  );
}

function renderProvider(initial: "en" | "uk" = "en") {
  return render(
    <LocaleProvider userId={"user1" as never} initialLocale={initial}>
      <Probe />
    </LocaleProvider>
  );
}

beforeEach(() => {
  updatePreferencesMock.mockReset().mockResolvedValue(undefined);
  vi.mocked(useMutation).mockReturnValue(updatePreferencesMock as never);
});

describe("LocaleProvider", () => {
  it("marks the app's language on a wrapper, since the root <html lang> is fixed", () => {
    renderProvider("uk");
    expect(screen.getByTestId("locale").closest("[lang]")).toHaveAttribute("lang", "uk");
  });

  it("updates the lang attribute when the language is switched, and persists the choice", async () => {
    renderProvider("en");
    expect(screen.getByTestId("locale").closest("[lang]")).toHaveAttribute("lang", "en");

    await act(async () => screen.getByRole("button", { name: "to uk" }).click());

    expect(screen.getByTestId("locale").closest("[lang]")).toHaveAttribute("lang", "uk");
    expect(updatePreferencesMock).toHaveBeenCalledWith({ userId: "user1", locale: "uk" });
  });

  it("rolls the language (and lang attribute) back if saving fails", async () => {
    updatePreferencesMock.mockRejectedValue(new Error("offline"));
    renderProvider("en");

    await act(async () => screen.getByRole("button", { name: "to uk" }).click());

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("locale").closest("[lang]")).toHaveAttribute("lang", "en");
  });
});
