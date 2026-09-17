import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, generateStructuredMock, convexQueryMock, convexMutationMock } = vi.hoisted(
  () => ({
    requireCurrentUserMock: vi.fn(),
    generateStructuredMock: vi.fn(),
    convexQueryMock: vi.fn(),
    convexMutationMock: vi.fn(),
  })
);

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock, convexMutation: convexMutationMock }));

import { POST } from "@/app/api/translate/project/route";

const PROJECT_DETAIL = {
  project: { userId: FAKE_USER._id, title: "Kanban", description: "d", contentLocale: "en" },
  tasks: [{ taskCode: "FE-101", title: "t", requirements: ["r"] }],
};

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, locale: "uk" });
  convexQueryMock.mockResolvedValue(PROJECT_DETAIL);
  convexMutationMock.mockResolvedValue("cache-id");
});

describe("POST /api/translate/project", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ projectId: "project1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the project doesn't belong to the caller", async () => {
    convexQueryMock.mockResolvedValue({
      ...PROJECT_DETAIL,
      project: { ...PROJECT_DETAIL.project, userId: "other" },
    });
    const res = await POST(jsonRequest({ projectId: "project1" }));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("returns translated: null with no Gemini call when the locale already matches", async () => {
    convexQueryMock.mockResolvedValue({
      ...PROJECT_DETAIL,
      project: { ...PROJECT_DETAIL.project, contentLocale: "uk" },
    });

    const res = await POST(jsonRequest({ projectId: "project1" }));

    const { body } = await statusAndBody(res);
    expect(body.translated).toBeNull();
    expect(generateStructuredMock).not.toHaveBeenCalled();
  });

  it("returns the cached translation without calling Gemini when one exists", async () => {
    const cached = { title: "Канбан", description: "d", tasks: [{ taskCode: "FE-101", title: "т", requirements: ["р"] }] };
    let callCount = 0;
    convexQueryMock.mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(callCount === 1 ? PROJECT_DETAIL : JSON.stringify(cached));
    });

    const res = await POST(jsonRequest({ projectId: "project1" }));

    const { body } = await statusAndBody(res);
    expect(body.translated).toEqual(cached);
    expect(generateStructuredMock).not.toHaveBeenCalled();
    expect(convexMutationMock).not.toHaveBeenCalled();
  });
});
