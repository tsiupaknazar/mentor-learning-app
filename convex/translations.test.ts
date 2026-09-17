import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("getCachedTranslation / saveTranslation", () => {
  it("returns null when nothing is cached", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.translations.getCachedTranslation, {
      sourceTable: "exercises",
      sourceId: "ex1",
      locale: "uk",
    });
    expect(result).toBeNull();
  });

  it("caches a translation and returns it on subsequent reads", async () => {
    const t = convexTest(schema);
    await t.mutation(api.translations.saveTranslation, {
      sourceTable: "exercises",
      sourceId: "ex1",
      locale: "uk",
      fields: JSON.stringify({ title: "Заголовок" }),
    });

    const result = await t.query(api.translations.getCachedTranslation, {
      sourceTable: "exercises",
      sourceId: "ex1",
      locale: "uk",
    });
    expect(JSON.parse(result!)).toEqual({ title: "Заголовок" });
  });

  it("upserts idempotently: a second save overwrites rather than duplicating", async () => {
    const t = convexTest(schema);
    await t.mutation(api.translations.saveTranslation, {
      sourceTable: "exercises",
      sourceId: "ex1",
      locale: "uk",
      fields: JSON.stringify({ title: "Old" }),
    });
    await t.mutation(api.translations.saveTranslation, {
      sourceTable: "exercises",
      sourceId: "ex1",
      locale: "uk",
      fields: JSON.stringify({ title: "New" }),
    });

    const rows = await t.run((ctx) => ctx.db.query("contentTranslations").collect());
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.fields)).toEqual({ title: "New" });
  });

  it("keeps separate cache entries per locale for the same source", async () => {
    const t = convexTest(schema);
    await t.mutation(api.translations.saveTranslation, {
      sourceTable: "exercises",
      sourceId: "ex1",
      locale: "uk",
      fields: JSON.stringify({ title: "UK" }),
    });
    await t.mutation(api.translations.saveTranslation, {
      sourceTable: "exercises",
      sourceId: "ex1",
      locale: "en",
      fields: JSON.stringify({ title: "EN" }),
    });

    const rows = await t.run((ctx) => ctx.db.query("contentTranslations").collect());
    expect(rows).toHaveLength(2);
  });
});
