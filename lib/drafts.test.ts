import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "./drafts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("drafts", () => {
  it("round-trips structured values", () => {
    saveDraft("k", { files: [{ filename: "a.js", content: "x" }] });
    expect(loadDraft("k")).toEqual({ files: [{ filename: "a.js", content: "x" }] });
  });

  it("returns null for a missing key and after clearDraft", () => {
    expect(loadDraft("nope")).toBeNull();
    saveDraft("k", "v");
    clearDraft("k");
    expect(loadDraft("k")).toBeNull();
  });

  it("drops (and removes) drafts older than the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    saveDraft("k", "v");

    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    expect(loadDraft("k", 60_000)).toBe("v");

    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
    expect(loadDraft("k", 60_000)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("ignores corrupt stored data", () => {
    localStorage.setItem("unsparing:draft:k", "{not json");
    expect(loadDraft("k")).toBeNull();
  });

  it("never throws when storage is unavailable or full", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => saveDraft("k", "v")).not.toThrow();
    expect(loadDraft("k")).toBeNull();
    expect(() => clearDraft("k")).not.toThrow();
  });

  it("is a no-op when there is no localStorage at all (server render)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => saveDraft("k", "v")).not.toThrow();
    expect(loadDraft("k")).toBeNull();
  });
});
