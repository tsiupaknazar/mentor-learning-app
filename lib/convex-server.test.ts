import { describe, expect, it, vi, beforeEach } from "vitest";
import { ClerkOfflineError } from "@clerk/nextjs/errors";

const { authMock, fetchQueryMock, fetchMutationMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  fetchQueryMock: vi.fn(),
  fetchMutationMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("convex/nextjs", () => ({
  fetchQuery: fetchQueryMock,
  fetchMutation: fetchMutationMock,
}));

import { convexQuery, convexMutation } from "@/lib/convex-server";

beforeEach(() => {
  authMock.mockReset();
  fetchQueryMock.mockReset();
  fetchMutationMock.mockReset();
  fetchQueryMock.mockResolvedValue("query-result");
  fetchMutationMock.mockResolvedValue("mutation-result");
});

describe("convexQuery / convexMutation auth token handling", () => {
  it("passes the resolved token through to fetchQuery", async () => {
    authMock.mockResolvedValue({ getToken: vi.fn().mockResolvedValue("real-token") });

    await convexQuery({} as any, {});

    expect(fetchQueryMock).toHaveBeenCalledWith({}, {}, { token: "real-token" });
  });

  it("passes no token when getToken resolves null", async () => {
    authMock.mockResolvedValue({ getToken: vi.fn().mockResolvedValue(null) });

    await convexMutation({} as any, {});

    expect(fetchMutationMock).toHaveBeenCalledWith({}, {}, undefined);
  });

  it("treats a ClerkOfflineError the same as no token, rather than throwing", async () => {
    authMock.mockResolvedValue({
      getToken: vi.fn().mockRejectedValue(new ClerkOfflineError("offline")),
    });

    await convexQuery({} as any, {});

    expect(fetchQueryMock).toHaveBeenCalledWith({}, {}, undefined);
  });

  it("rethrows any other error from getToken", async () => {
    authMock.mockResolvedValue({
      getToken: vi.fn().mockRejectedValue(new Error("boom")),
    });

    await expect(convexQuery({} as any, {})).rejects.toThrow("boom");
    expect(fetchQueryMock).not.toHaveBeenCalled();
  });
});
