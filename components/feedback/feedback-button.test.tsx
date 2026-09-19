import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackButton } from "./feedback-button";

describe("FeedbackButton", () => {
  it("keeps its accessible name even though the label is visually hidden on phones", () => {
    render(<FeedbackButton />);
    const button = screen.getByRole("button", { name: /feedback/i });
    // The label is still in the DOM (sr-only below sm), so screen readers and
    // tests find it by name; only the visual footprint shrinks on small screens.
    expect(button.querySelector("span")?.className).toContain("sr-only");
  });

  it("opens the feedback dialog", async () => {
    const user = userEvent.setup();
    render(<FeedbackButton />);

    await user.click(screen.getByRole("button", { name: /feedback/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  describe("sending", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    async function sendWith(response: () => Response | Promise<Response>) {
      vi.stubGlobal("fetch", vi.fn(async () => response()));
      const user = userEvent.setup();
      render(<FeedbackButton />);
      await user.click(screen.getByRole("button", { name: /feedback/i }));
      await user.type(await screen.findByPlaceholderText("What happened, or what would help?"), "It broke");
      await user.click(screen.getByRole("button", { name: "Send feedback" }));
    }

    it("confirms once it is sent", async () => {
      await sendWith(() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
      expect(await screen.findByText("Thanks — sent!")).toBeInTheDocument();
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/feedback", expect.objectContaining({ method: "POST" }));
    });

    it("shows the feature's own error for an unclassified failure", async () => {
      await sendWith(() => new Response("{}", { status: 500 }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't send that — please try again in a moment.");
    });

    it("tells an offline learner to check their connection", async () => {
      await sendWith(() => {
        throw new TypeError("Failed to fetch");
      });
      expect(await screen.findByRole("alert")).toHaveTextContent("Can’t reach the server. Check your connection and try again.");
    });
  });
});
