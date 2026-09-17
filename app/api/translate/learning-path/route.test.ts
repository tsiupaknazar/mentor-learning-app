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

import { POST } from "@/app/api/translate/learning-path/route";

const PATH_DATA = {
  path: { userId: FAKE_USER._id, title: "JS Path", rationale: "r", contentLocale: "en" },
  topics: [{ externalId: "closures", title: "Closures", summary: "s" }],
};

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, locale: "uk" });
  convexQueryMock.mockResolvedValue(PATH_DATA);
  convexMutationMock.mockResolvedValue("cache-id");
});

describe("POST /api/translate/learning-path", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ learningPathId: "path1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the path doesn't belong to the caller", async () => {
    convexQueryMock.mockResolvedValue({ ...PATH_DATA, path: { ...PATH_DATA.path, userId: "other" } });
    const res = await POST(jsonRequest({ learningPathId: "path1" }));
    const { status, body } = await statusAndBody(res);
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("returns translated: null with no Gemini call when the locale already matches", async () => {
    convexQueryMock.mockResolvedValue({ ...PATH_DATA, path: { ...PATH_DATA.path, contentLocale: "uk" } });

    const res = await POST(jsonRequest({ learningPathId: "path1" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.translated).toBeNull();
    expect(generateStructuredMock).not.toHaveBeenCalled();
  });

  it("generates, caches, and returns a translation when locales differ and nothing is cached", async () => {
    // First convexQuery call (getLearningPathWithTopics) returns PATH_DATA;
    // second (getCachedTranslation) must return null to force generation.
    let callCount = 0;
    convexQueryMock.mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(callCount === 1 ? PATH_DATA : null);
    });
    const translated = { title: "Шлях", rationale: "r", knowledgeProfileSummary: null, topics: [] };
    generateStructuredMock.mockResolvedValue(translated);

    const res = await POST(jsonRequest({ learningPathId: "path1" }));

    const { body } = await statusAndBody(res);
    expect(body.translated).toEqual(translated);
    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceTable: "learningPaths", sourceId: "path1" })
    );
  });
});
