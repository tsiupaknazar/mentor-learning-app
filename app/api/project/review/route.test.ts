import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER, FAKE_LEARNER_CONTEXT } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const {
  requireCurrentUserMock,
  generateStructuredMock,
  getLearnerContextMock,
  convexQueryMock,
  convexMutationMock,
} = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  generateStructuredMock: vi.fn(),
  getLearnerContextMock: vi.fn(),
  convexQueryMock: vi.fn(),
  convexMutationMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));
vi.mock("@/lib/learner-context", () => ({ getLearnerContext: getLearnerContextMock }));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock, convexMutation: convexMutationMock }));

import { POST } from "@/app/api/project/review/route";

const TASK_DETAIL = {
  task: { userId: FAKE_USER._id, taskCode: "FE-101", title: "Build the form", requirements: ["r1"] },
  submissionsWithReviews: [],
};

const VALID_BODY = {
  projectTaskId: "task1",
  files: [{ filename: "index.html", content: "<form></form>" }],
};

const REVIEW = { verdict: "approved", summary: "Looks good", comments: [] };

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  getLearnerContextMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
  getLearnerContextMock.mockResolvedValue(FAKE_LEARNER_CONTEXT);
  convexQueryMock.mockResolvedValue(TASK_DETAIL);
  convexMutationMock.mockResolvedValue({ submissionId: "sub1", taskStatus: "done" });
  generateStructuredMock.mockResolvedValue(REVIEW);
});

describe("POST /api/project/review", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid body (no files)", async () => {
    const res = await POST(jsonRequest({ ...VALID_BODY, files: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the task doesn't belong to the caller", async () => {
    convexQueryMock.mockResolvedValue({ ...TASK_DETAIL, task: { ...TASK_DETAIL.task, userId: "other" } });
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("does not pass a previous review on a first submission", async () => {
    await POST(jsonRequest(VALID_BODY));

    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain("This is the first submission for this task.");
  });

  it("passes the previous changes_requested review when resubmitting", async () => {
    convexQueryMock.mockResolvedValue({
      ...TASK_DETAIL,
      submissionsWithReviews: [
        {
          submission: {},
          review: { verdict: "changes_requested", summary: "Missing validation", comments: [] },
        },
      ],
    });

    await POST(jsonRequest(VALID_BODY));

    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain("Missing validation");
  });

  it("does not carry forward a previous APPROVED review as if it needed re-addressing", async () => {
    convexQueryMock.mockResolvedValue({
      ...TASK_DETAIL,
      submissionsWithReviews: [
        { submission: {}, review: { verdict: "approved", summary: "Great", comments: [] } },
      ],
    });

    await POST(jsonRequest(VALID_BODY));

    const promptArg = generateStructuredMock.mock.calls[0]![0];
    expect(promptArg.prompt).toContain("This is the first submission for this task.");
  });

  it("returns the review and resulting task status", async () => {
    const res = await POST(jsonRequest(VALID_BODY));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.review).toEqual(REVIEW);
    expect(body.taskStatus).toBe("done");
  });
});
