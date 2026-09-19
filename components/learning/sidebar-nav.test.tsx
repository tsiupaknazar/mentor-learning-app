import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { SidebarNav } from "./sidebar-nav";

const CLERK_USER = { id: "clerk_1" };
const APP_USER = { _id: "user1" };

function mockQueries(summary: unknown) {
  vi.mocked(useQuery).mockImplementation((_query, args?) => {
    if (args === "skip") return undefined;
    if (args && typeof args === "object" && "clerkId" in args) return APP_USER;
    return summary;
  });
}

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/dashboard");
  vi.mocked(useUser).mockReturnValue({ isLoaded: true, user: CLERK_USER } as never);
  mockQueries({ user: { currentStreak: 0 } });
});

describe("SidebarNav", () => {
  it("highlights the nav item matching the current path", () => {
    render(<SidebarNav />);
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/ });
    expect(dashboardLink.className).toContain("bg-muted text-foreground");
    const learnLink = screen.getByRole("link", { name: /Learn/ });
    expect(learnLink.className).not.toContain("bg-muted text-foreground");
  });

  it("highlights the nav item for a sub-path (e.g. /learn/123 highlights Learn)", () => {
    vi.mocked(usePathname).mockReturnValue("/learn/123");
    render(<SidebarNav />);
    expect(screen.getByRole("link", { name: /Learn/ }).className).toContain("bg-muted text-foreground");
  });

  it("renders through the loading state (no Clerk user yet) without crashing", () => {
    vi.mocked(useUser).mockReturnValue({ isLoaded: false, user: null } as never);
    mockQueries(undefined);
    render(<SidebarNav />);
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
  });

  it("shows the singular 'day' label at a streak of 1", () => {
    mockQueries({ user: { currentStreak: 1 } });
    render(<SidebarNav />);
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it("shows the plural 'days' label at a streak other than 1", () => {
    mockQueries({ user: { currentStreak: 3 } });
    render(<SidebarNav />);
    expect(screen.getByText("3 days")).toBeInTheDocument();
  });

  it("marks only the current page's link with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/learn/123");
    render(<SidebarNav />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["Learn"]);
  });

  describe("mobile menu", () => {
    const drawer = () => document.getElementById("mobile-nav");

    it("is closed until the menu button is pressed, and the button reports its state", async () => {
      const user = userEvent.setup();
      render(<SidebarNav />);
      const button = screen.getByRole("button", { name: "Open menu" });
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(drawer()).toBeNull();

      await user.click(button);

      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(drawer()).not.toBeNull();
      expect(within(drawer()!).getByRole("link", { name: /Practice/ })).toHaveAttribute("href", "/practice");
    });

    it("closes with the close button, Escape, or a tap on the backdrop", async () => {
      const user = userEvent.setup();
      render(<SidebarNav />);

      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(screen.getByRole("button", { name: "Close menu" }));
      expect(drawer()).toBeNull();

      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.keyboard("{Escape}");
      expect(drawer()).toBeNull();

      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(drawer()!.previousElementSibling as HTMLElement); // the backdrop
      expect(drawer()).toBeNull();
    });

    it("closes after choosing a destination", async () => {
      const user = userEvent.setup();
      render(<SidebarNav />);
      await user.click(screen.getByRole("button", { name: "Open menu" }));

      await user.click(within(drawer()!).getByRole("link", { name: /Mistakes/ }));

      expect(drawer()).toBeNull();
    });
  });
});
