import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiError, apiErrorMessage, apiFetch } from "./api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";

const t = dictionaries.en;

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function kindOf(res: Response) {
  stubFetch(async () => res);
  try {
    await apiFetch("/api/x", {});
  } catch (e) {
    return (e as ApiError).kind;
  }
  return null;
}

describe("apiFetch", () => {
  it("POSTs JSON and returns the parsed body", async () => {
    stubFetch(async () => json({ ok: 1 }));
    await expect(apiFetch("/api/x", { a: 1 })).resolves.toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ a: 1 }), headers: { "Content-Type": "application/json" } })
    );
  });

  it("returns undefined for an empty success body instead of throwing", async () => {
    stubFetch(async () => new Response(null, { status: 200 }));
    await expect(apiFetch("/api/x", {})).resolves.toBeUndefined();
  });

  it("classifies failures from the status and the route's error code", async () => {
    expect(await kindOf(json({ error: "unauthenticated" }, 401))).toBe("unauthenticated");
    expect(await kindOf(json({ error: "onboarding_incomplete" }, 403))).toBe("onboarding_incomplete");
    expect(await kindOf(json({ error: "topic_locked" }, 403))).toBe("topic_locked");
    expect(await kindOf(json({}, 429))).toBe("rate_limited");
    expect(await kindOf(json({ error: "ai_not_configured" }, 503))).toBe("ai_unavailable");
    expect(await kindOf(json({ error: "ai_request_failed" }, 502))).toBe("ai_failed");
    expect(await kindOf(json({ error: "invalid_request" }, 400))).toBe("invalid");
    expect(await kindOf(json({ error: "internal_error" }, 500))).toBe("server");
  });

  it("tells a real missing record apart from the auth middleware's bare 404", async () => {
    expect(await kindOf(json({ error: "not_found" }, 404))).toBe("not_found");
    expect(await kindOf(new Response("Not Found", { status: 404 }))).toBe("unauthenticated");
  });

  it("keeps the status when the error body isn't JSON (e.g. a proxy's HTML page)", async () => {
    stubFetch(async () => new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(apiFetch("/api/x", {})).rejects.toMatchObject({ kind: "ai_failed", status: 502 });
  });

  it("reports a request that never got a response as a network error", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(apiFetch("/api/x", {})).rejects.toMatchObject({ kind: "network", status: null });
  });
});

describe("apiErrorMessage", () => {
  const fallback = "Could not do the thing.";

  it("gives advice for failures that have a universal remedy", () => {
    expect(apiErrorMessage(new ApiError("unauthenticated", 401), t, fallback)).toBe(t.common.sessionExpired);
    expect(apiErrorMessage(new ApiError("network", null), t, fallback)).toBe(t.common.offline);
    expect(apiErrorMessage(new ApiError("rate_limited", 429), t, fallback)).toBe(t.common.rateLimited);
    expect(apiErrorMessage(new ApiError("ai_failed", 502), t, fallback)).toBe(t.common.aiBusy);
    expect(apiErrorMessage(new ApiError("ai_unavailable", 503), t, fallback)).toBe(t.common.aiUnavailable);
    expect(apiErrorMessage(new ApiError("topic_locked", 403), t, fallback)).toBe(t.common.topicLocked);
  });

  it("falls back to the feature's own message for everything else", () => {
    expect(apiErrorMessage(new ApiError("invalid", 400), t, fallback)).toBe(fallback);
    expect(apiErrorMessage(new ApiError("server", 500), t, fallback)).toBe(fallback);
    expect(apiErrorMessage(new ApiError("not_found", 404), t, fallback)).toBe(fallback);
    expect(apiErrorMessage(new Error("boom"), t, fallback)).toBe(fallback);
    expect(apiErrorMessage("nope", t, fallback)).toBe(fallback);
  });
});
