import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const sourceTable = v.union(
  v.literal("learningPaths"),
  v.literal("projects"),
  v.literal("exercises"),
  v.literal("mistakes")
);
const locale = v.union(v.literal("en"), v.literal("uk"));

/** Returns a cached translation bundle (as a raw JSON string — parsed by the caller against the matching Zod schema), or null if this content has never been translated into this locale. */
export const getCachedTranslation = query({
  args: { sourceTable, sourceId: v.string(), locale },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("contentTranslations")
      .withIndex("by_source", (q) =>
        q.eq("sourceTable", args.sourceTable).eq("sourceId", args.sourceId).eq("locale", args.locale)
      )
      .unique();
    return row?.fields ?? null;
  },
});

/**
 * Upserts a translation bundle. Idempotent by (sourceTable, sourceId,
 * locale) — if two requests race to translate the same content into the
 * same locale (e.g. two tabs open), the second just overwrites with an
 * equivalent translation rather than creating a duplicate cache row.
 */
export const saveTranslation = mutation({
  args: { sourceTable, sourceId: v.string(), locale, fields: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contentTranslations")
      .withIndex("by_source", (q) =>
        q.eq("sourceTable", args.sourceTable).eq("sourceId", args.sourceId).eq("locale", args.locale)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { fields: args.fields });
      return existing._id;
    }
    return ctx.db.insert("contentTranslations", {
      sourceTable: args.sourceTable,
      sourceId: args.sourceId,
      locale: args.locale,
      fields: args.fields,
      createdAt: Date.now(),
    });
  },
});
