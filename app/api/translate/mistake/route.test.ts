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

import { POST } from "@/app/api/translate/mistake/route";

const MISTAKE_ROW = { _id: "m1", userId: FAKE_USER._id, description: "Off-by-one", contentLocale: "en" };

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  convexQueryMock.mockReset();
  convexMutationMock.mockReset();
  requireCurrentUserMock.mockResolvedValue({ ...FAKE_USER, locale: "uk" });
  convexMutationMock.mockResolvedValue("cache-row-id");
});

describe("POST /api/translate/mistake", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ mistakeIds: ["m1"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for more than 30 ids", async () => {
    const ids = Array.from({ length: 31 }, (_, i) => `m${i}`);
    const res = await POST(jsonRequest({ mistakeIds: ids }));
    expect(res.status).toBe(400);
  });

  it("calls Gemini and caches the result when nothing is cached yet", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "mistakeId" in args ? Promise.resolve(MISTAKE_ROW) : Promise.resolve(null)
    );
    generateStructuredMock.mockResolvedValue({
      mistakes: [{ id: "m1", description: "Позаоднеу" }],
    });

    const res = await POST(jsonRequest({ mistakeIds: ["m1"] }));

    const { body } = await statusAndBody(res);
    expect(body.translated.m1.description).toBe("Позаоднеу");
    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceTable: "mistakes", sourceId: "m1" })
    );
  });

  it("skips a mistake whose contentLocale already matches the target locale", async () => {
    convexQueryMock.mockImplementation((_query, args) =>
      "mistakeId" in args ? Promise.resolve({ ...MISTAKE_ROW, contentLocale: "uk" }) : Promise.resolve(null)
    );

    const res = await POST(jsonRequest({ mistakeIds: ["m1"] }));

    const { body } = await statusAndBody(res);
    expect(body.translated).toEqual({});
    expect(generateStructuredMock).not.toHaveBeenCalled();
  });
});
