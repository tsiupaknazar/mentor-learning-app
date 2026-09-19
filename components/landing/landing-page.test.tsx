import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LandingPage } from "./landing-page";
import { dictionaries } from "@/lib/i18n/dictionaries";

describe("LandingPage", () => {
  it("renders English copy from the dictionary, marked lang=en", () => {
    const { container } = render(<LandingPage locale="en" />);
    const t = dictionaries.en.landing;

    expect(container.firstElementChild).toHaveAttribute("lang", "en");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.heroTitle);
    expect(screen.getByText(t.heroSubtitle)).toBeInTheDocument();
    expect(screen.getByText(t.footer)).toBeInTheDocument();
  });

  it("renders the Ukrainian translation, marked lang=uk, with no English hero copy left over", () => {
    const { container } = render(<LandingPage locale="uk" />);
    const en = dictionaries.en.landing;
    const uk = dictionaries.uk.landing;

    expect(container.firstElementChild).toHaveAttribute("lang", "uk");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(uk.heroTitle);
    expect(screen.getByText(uk.loopCaption)).toBeInTheDocument();
    expect(container.textContent).not.toContain(en.heroSubtitle);
    expect(container.textContent).not.toContain(en.loopCaption);
  });

  it("shows every loop stage, in order, in the chosen language", () => {
    render(<LandingPage locale="uk" />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("p")?.textContent)).toEqual(dictionaries.uk.landing.loopStages);
  });

  it("offers both languages as links to their own pages, marking the current one", () => {
    render(<LandingPage locale="uk" />);
    const group = screen.getByRole("group", { name: "Language" });

    expect(within(group).getByRole("link", { name: "EN" })).toHaveAttribute("href", "/");
    const uk = within(group).getByRole("link", { name: "UK" });
    expect(uk).toHaveAttribute("href", "/uk");
    expect(uk).toHaveAttribute("aria-current", "true");
    expect(within(group).getByRole("link", { name: "EN" })).not.toHaveAttribute("aria-current");
  });

  it("points sign-in and sign-up at the auth pages in both languages", () => {
    for (const locale of ["en", "uk"] as const) {
      const { unmount } = render(<LandingPage locale={locale} />);
      const t = dictionaries[locale].landing;
      expect(screen.getByRole("link", { name: t.signIn })).toHaveAttribute("href", "/sign-in");
      expect(screen.getAllByRole("link", { name: new RegExp(t.startLearning) })[0]).toHaveAttribute("href", "/sign-up");
      unmount();
    }
  });

  it("embeds the structured data for search engines", () => {
    const { container } = render(<LandingPage locale="en" />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(() => JSON.parse(script!.textContent ?? "")).not.toThrow();
  });
});
