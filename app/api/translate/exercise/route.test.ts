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

import { POST } from "@/app/api/translate/exercise/route";

const EXERCISE_ROW = {
  _id: "ex1",
  userId: FAKE_USER._id,
  title: "Fix it",
  subtopic: "closures",
  prompt: "p",
  choices: null,
  contentLocale: "en",
};

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, locale: "uk" });
  convexMutationMock.mockResolvedValue("cache-row-id");
});

describe("POST /api/translate/exercise", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ exerciseIds: ["ex1"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for more than 24 ids", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `ex${i}`);
    const res = await POST(jsonRequest({ exerciseIds: ids }));
    expect(res.status).toBe(400);
  });

  it("skips Gemini and returns the cached translation when one exists", async () => {
    const cachedTranslation = { id: "ex1", title: "Заголовок", subtopic: "closures", prompt: "p", choices: null };
    convexQueryMock.mockImplementation((_query, args) => {
      if ("exerciseId" in args) return Promise.resolve(EXERCISE_ROW);
      return Promise.resolve(JSON.stringify(cachedTranslation)); // getCachedTranslation
    });

    const res = await POST(jsonRequest({ exerciseIds: ["ex1"] }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.translated.ex1).toEqual(cachedTranslation);
    expect(generateStructuredMock).not.toHaveBeenCalled();
  });

  it("calls Gemini and caches the result when nothing is cached yet", async () => {
    convexQueryMock.mockImplementation((_query, args) => {
      if ("exerciseId" in args) return Promise.resolve(EXERCISE_ROW);
      return Promise.resolve(null); // no cache
    });
    generateStructuredMock.mockResolvedValue({
      exercises: [{ id: "ex1", title: "Заголовок", subtopic: "closures", prompt: "p", choices: null }],
    });

    const res = await POST(jsonRequest({ exerciseIds: ["ex1"] }));

    const { body } = await statusAndBody(res);
    expect(body.translated.ex1.title).toBe("Заголовок");
    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceTable: "exercises", sourceId: "ex1" })
    );
  });

  it("silently drops an exercise the model omitted from its response", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "exerciseId" in args ? Promise.resolve(EXERCISE_ROW) : Promise.resolve(null)
    );
    generateStructuredMock.mockResolvedValue({ exercises: [] }); // model dropped ex1

    const res = await POST(jsonRequest({ exerciseIds: ["ex1"] }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.translated).toEqual({});
    expect(convexMutationMock).not.toHaveBeenCalled();
  });

  it("skips a row entirely when its contentLocale already matches the target locale", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "exerciseId" in args ? Promise.resolve({ ...EXERCISE_ROW, contentLocale: "uk" }) : Promise.resolve(null)
    );

    const res = await POST(jsonRequest({ exerciseIds: ["ex1"] }));

    const { body } = await statusAndBody(res);
    expect(body.translated).toEqual({});
    expect(generateStructuredMock).not.toHaveBeenCalled();
  });

  it("excludes exercises not owned by the caller", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "exerciseId" in args ? Promise.resolve({ ...EXERCISE_ROW, userId: "other" }) : Promise.resolve(null)
    );

    const res = await POST(jsonRequest({ exerciseIds: ["ex1"] }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.translated).toEqual({});
  });
});
