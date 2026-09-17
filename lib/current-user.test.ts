import { describe, expect, it, vi, beforeEach } from "vitest";

const { authMock, convexQueryMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  convexQueryMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/convex-server", () => ({ convexQuery: convexQueryMock }));

import { requireCurrentUser, UnauthenticatedError } from "@/lib/current-user";

beforeEach(() => {
  authMock.mockReset();
  convexQueryMock.mockReset();
});

describe("requireCurrentUser", () => {
  it("throws UnauthenticatedError when there is no Clerk session", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(requireCurrentUser()).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(convexQueryMock).not.toHaveBeenCalled();
  });

  it("throws UnauthenticatedError when the Clerk user has no matching Convex row", async () => {
    authMock.mockResolvedValue({ userId: "clerk_123" });
    convexQueryMock.mockResolvedValue(null);

    await expect(requireCurrentUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("returns the Convex user row on success", async () => {
    authMock.mockResolvedValue({ userId: "clerk_123" });
    const user = { _id: "user1", clerkId: "clerk_123" };
    convexQueryMock.mockResolvedValue(user);

    await expect(requireCurrentUser()).resolves.toBe(user);
    expect(convexQueryMock).toHaveBeenCalledWith(
      expect.anything(),
      { clerkId: "clerk_123" }
    );
  });
});
