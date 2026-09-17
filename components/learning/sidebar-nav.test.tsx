import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
