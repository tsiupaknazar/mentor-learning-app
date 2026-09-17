import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";
import { EmailRequestError } from "@/lib/email";

const { requireCurrentUserMock, sendFeedbackEmailMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  sendFeedbackEmailMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sendFeedbackEmail: sendFeedbackEmailMock,
}));

import { POST } from "@/app/api/feedback/route";

const VALID_BODY = { message: "It broke", category: "bug", rating: 3, route: "/practice" };

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  sendFeedbackEmailMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  sendFeedbackEmailMock.mockResolvedValue(undefined);
});

describe("POST /api/feedback", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid body", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, message: "" }));
    expect(res.status).toBe(400);
  });

  it("sends the feedback email with the server-captured user context, not client-supplied identity", async () => {
    const res = await POST(jsonRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(sendFeedbackEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "It broke",
        userEmail: FAKE_USER.email,
        userDisplayName: FAKE_USER.displayName,
        userId: FAKE_USER._id,
      })
    );
  });

  it("propagates an email send failure as a 502", async () => {
    sendFeedbackEmailMock.mockRejectedValue(new EmailRequestError("failed", "cause"));

    const res = await POST(jsonRequest(VALID_BODY));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(502);
    expect(body.error).toBe("email_send_failed");
  });
});
