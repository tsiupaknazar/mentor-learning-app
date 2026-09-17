import { describe, expect, it, vi, beforeEach } from "vitest";
import { jsonRequest, statusAndBody, FAKE_USER } from "@/app/api/test-helpers";
import { UnauthenticatedError } from "@/lib/current-user";

const { requireCurrentUserMock, generateStructuredMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  generateStructuredMock: vi.fn(),
}));

vi.mock("@/lib/current-user", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireCurrentUser: requireCurrentUserMock,
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStructured: generateStructuredMock,
}));

import { POST } from "@/app/api/diagnostic/questions/route";

beforeEach(() => {
  requireCurrentUserMock.mockReset();
  generateStructuredMock.mockReset();
  requireCurrentUserMock.mockResolvedValue(FAKE_USER);
});

describe("POST /api/diagnostic/questions", () => {
  it("returns 401 when unauthenticated", async () => {
    requireCurrentUserMock.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(jsonRequest({ topic: "SQL", selfReportedLevel: "beginner" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid selfReportedLevel", async () => {
    const res = await POST(jsonRequest({ topic: "SQL", selfReportedLevel: "expert" }));
    const { status } = await statusAndBody(res);
    expect(status).toBe(400);
  });

  it("generates a diagnostic set with the reasoning tier", async () => {
    const diagnostic = { topic: "SQL", questions: [] };
    generateStructuredMock.mockResolvedValue(diagnostic);

    const res = await POST(jsonRequest({ topic: "SQL", selfReportedLevel: "beginner" }));

    const { status, body } = await statusAndBody(res);
    expect(status).toBe(200);
    expect(body.diagnostic).toEqual(diagnostic);
    expect(generateStructuredMock.mock.calls[0]![0].tier).toBe("reasoning");
  });
});
