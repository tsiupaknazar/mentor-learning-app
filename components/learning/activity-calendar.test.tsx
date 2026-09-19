import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ActivityCalendar } from "./activity-calendar";

const TODAY = "2024-06-12"; // a Wednesday

describe("ActivityCalendar", () => {
  it("summarises the activity in words, not just colour", () => {
    render(
      <ActivityCalendar
        todayIso={TODAY}
        days={[
          { date: "2024-06-12", count: 3 },
          { date: "2024-06-10", count: 2 },
        ]}
      />
    );
    expect(screen.getByText("5 answers on 2 active days")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity, last 12 weeks" })).toBeInTheDocument();
  });

  it("labels every visible day for screen readers, with the right count", () => {
    render(<ActivityCalendar todayIso={TODAY} days={[{ date: "2024-06-12", count: 3 }, { date: "2024-06-11", count: 1 }]} />);
    const group = screen.getByRole("group", { name: "Activity, last 12 weeks" });

    expect(within(group).getByRole("img", { name: "2024-06-12: 3 answers" })).toBeInTheDocument();
    expect(within(group).getByRole("img", { name: "2024-06-11: 1 answer" })).toBeInTheDocument();
    expect(within(group).getByRole("img", { name: "2024-06-10: 0 answers" })).toBeInTheDocument();
  });

  it("renders 12 weeks of cells, hiding the days that haven't happened yet from assistive tech", () => {
    render(<ActivityCalendar todayIso={TODAY} days={[]} />);
    const group = screen.getByRole("group", { name: "Activity, last 12 weeks" });

    // 12 weeks x 7 days = 84 slots; Thursday-Sunday of this week (4) are in the future.
    expect(group.querySelectorAll('[role="img"]')).toHaveLength(84);
    expect(within(group).getAllByRole("img")).toHaveLength(80);
    expect(within(group).queryByRole("img", { name: /2024-06-13/ })).not.toBeInTheDocument();
  });

  it("shades busier days more strongly than quiet ones", () => {
    render(<ActivityCalendar todayIso={TODAY} days={[{ date: "2024-06-12", count: 1 }, { date: "2024-06-11", count: 9 }]} />);
    const busy = screen.getByRole("img", { name: "2024-06-11: 9 answers" });
    const quiet = screen.getByRole("img", { name: "2024-06-12: 1 answer" });
    const none = screen.getByRole("img", { name: "2024-06-10: 0 answers" });

    expect(busy.className).toContain("bg-accent");
    expect(busy.className).not.toContain("bg-accent/");
    expect(quiet.className).toContain("bg-accent/25");
    expect(none.className).toContain("bg-muted");
  });

  it("copes with no activity at all", () => {
    render(<ActivityCalendar todayIso={TODAY} days={[]} />);
    expect(screen.getByText("0 answers on 0 active days")).toBeInTheDocument();
  });
});
