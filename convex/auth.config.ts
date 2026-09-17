/**
 * Tells Convex to trust Clerk-issued JWTs. Requires a Clerk JWT template
 * named "convex" (Clerk dashboard -> JWT Templates -> New template ->
 * Convex) and CLERK_ISSUER_URL set in the Convex deployment's environment
 * variables (not this repo's .env — Convex env vars are set via
 * `npx convex env set` or the Convex dashboard).
 */
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
