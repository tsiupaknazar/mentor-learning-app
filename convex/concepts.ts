import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generous for a lesson (a few KB in practice); just a bound on what one
// signed-in caller can park in a shared row.
const MAX_KEY_LENGTH = 300;
const MAX_CONCEPT_LENGTH = 40_000;

/** A cached lesson as its JSON string (parsed and re-validated by the caller), or null on a miss. */
export const getCachedConcept = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("conceptCache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return row?.concept ?? null;
  },
});

/**
 * Stores a generated lesson for everyone with the same key. First write wins:
 * a row is never replaced, so a lesson that's been served keeps being the one
 * served, and a racing second generation is simply dropped.
 *
 * Any signed-in client can call this (Convex functions are public; the app has
 * no server-only credential to hold an internal one), so it's bounded rather
 * than trusted: it needs a signed-in caller, caps sizes, and requires valid
 * JSON. Readers still validate the lesson against the schema.
 */
export const saveConcept = mutation({
  args: { key: v.string(), concept: v.string() },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("unauthenticated");
    if (args.key.length > MAX_KEY_LENGTH || args.concept.length > MAX_CONCEPT_LENGTH) {
      throw new Error("concept too large");
    }
    try {
      JSON.parse(args.concept);
    } catch {
      throw new Error("concept is not valid JSON");
    }
    const existing = await ctx.db
      .query("conceptCache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("conceptCache", { key: args.key, concept: args.concept, createdAt: Date.now() });
  },
});
