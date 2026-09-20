import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const CONCEPT = JSON.stringify({ topic: "HTML", subtopic: "Headings", explanation: "e", keyPoints: ["a", "b"] });
const signedIn = (t: ReturnType<typeof convexTest>) => t.withIdentity({ subject: "clerk_1" });

describe("getCachedConcept / saveConcept", () => {
  it("misses when nothing is cached", async () => {
    const t = convexTest(schema);
    expect(await t.query(api.concepts.getCachedConcept, { key: "k" })).toBeNull();
  });

  it("returns a saved lesson to any later reader", async () => {
    const t = convexTest(schema);
    await signedIn(t).mutation(api.concepts.saveConcept, { key: "k", concept: CONCEPT });
    expect(await t.query(api.concepts.getCachedConcept, { key: "k" })).toBe(CONCEPT);
    expect(await t.query(api.concepts.getCachedConcept, { key: "other" })).toBeNull();
  });

  it("first write wins: a second save for the same key never replaces the served lesson", async () => {
    const t = convexTest(schema);
    await signedIn(t).mutation(api.concepts.saveConcept, { key: "k", concept: CONCEPT });
    await signedIn(t).mutation(api.concepts.saveConcept, { key: "k", concept: JSON.stringify({ other: 1 }) });

    expect(await t.query(api.concepts.getCachedConcept, { key: "k" })).toBe(CONCEPT);
    expect(await t.run((ctx) => ctx.db.query("conceptCache").collect())).toHaveLength(1);
  });

  it("refuses an anonymous caller, oversized input, and non-JSON", async () => {
    const t = convexTest(schema);
    await expect(t.mutation(api.concepts.saveConcept, { key: "k", concept: CONCEPT })).rejects.toThrow(/unauthenticated/);
    await expect(
      signedIn(t).mutation(api.concepts.saveConcept, { key: "k", concept: JSON.stringify("x".repeat(40_001)) })
    ).rejects.toThrow(/too large/);
    await expect(signedIn(t).mutation(api.concepts.saveConcept, { key: "k".repeat(301), concept: CONCEPT })).rejects.toThrow(
      /too large/
    );
    await expect(signedIn(t).mutation(api.concepts.saveConcept, { key: "k", concept: "not json" })).rejects.toThrow(
      /valid JSON/
    );
    expect(await t.run((ctx) => ctx.db.query("conceptCache").collect())).toHaveLength(0);
  });
});
