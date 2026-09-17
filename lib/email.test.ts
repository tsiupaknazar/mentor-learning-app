import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendFeedbackEmail, EmailConfigError, EmailRequestError } from "@/lib/email";

const VALID_INPUT = {
  message: "It broke <script>alert(1)</script> & didn't work",
  category: "bug" as const,
  rating: 4,
  route: "/practice",
  userEmail: "learner@example.com",
  userDisplayName: "Learner",
  userId: "user1",
  locale: "en",
};

function stubEnv() {
  vi.stubEnv("RESEND_API_KEY", "key");
  vi.stubEnv("FEEDBACK_EMAIL_TO", "team@example.com");
  vi.stubEnv("FEEDBACK_EMAIL_FROM", "noreply@example.com");
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendFeedbackEmail", () => {
  it("throws EmailConfigError when env vars are missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("FEEDBACK_EMAIL_TO", "");
    vi.stubEnv("FEEDBACK_EMAIL_FROM", "");

    await expect(sendFeedbackEmail(VALID_INPUT)).rejects.toBeInstanceOf(EmailConfigError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws EmailRequestError when fetch itself throws", async () => {
    stubEnv();
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(sendFeedbackEmail(VALID_INPUT)).rejects.toBeInstanceOf(EmailRequestError);
  });

  it("throws EmailRequestError when Resend responds non-ok", async () => {
    stubEnv();
    vi.mocked(fetch).mockResolvedValue(
      new Response("bad request", { status: 400 })
    );

    await expect(sendFeedbackEmail(VALID_INPUT)).rejects.toBeInstanceOf(EmailRequestError);
  });

  it("resolves on a successful send and HTML-escapes user content in the request body", async () => {
    stubEnv();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await expect(sendFeedbackEmail(VALID_INPUT)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(body.html).not.toContain("<script>alert(1)</script>");
    expect(body.html).toContain("&amp;");
    expect(body.reply_to).toBe(VALID_INPUT.userEmail);
  });

  it("omits the rating/category lines from the HTML body when not provided", async () => {
    stubEnv();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await sendFeedbackEmail({ ...VALID_INPUT, category: null, rating: null });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.html).not.toContain("Rating:");
    expect(body.html).not.toContain("Category:");
  });
});
