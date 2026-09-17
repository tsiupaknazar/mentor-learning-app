import "server-only";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ClerkOfflineError } from "@clerk/nextjs/errors";
import type { FunctionReference } from "convex/server";

/**
 * Every server-side (API route / route handler) call into Convex goes
 * through here so the Clerk session token is attached consistently and
 * `convex/auth.config.ts`'s row-level checks can trust `ctx.auth`.
 *
 * Clerk 7 throws `ClerkOfflineError` from `getToken()` instead of resolving
 * `null` when the request to Clerk itself can't be made — treated the same
 * as "no token" here (falls through to an unauthenticated Convex call, same
 * as pre-upgrade behavior) rather than letting it become an uncaught 500.
 */
async function getAuthToken(): Promise<string | undefined> {
  const { getToken } = await auth();
  try {
    return (await getToken({ template: "convex" })) ?? undefined;
  } catch (err) {
    if (ClerkOfflineError.is(err)) return undefined;
    throw err;
  }
}

export async function convexQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"]
): Promise<Query["_returnType"]> {
  const token = await getAuthToken();
  return fetchQuery(query, args, token ? { token } : undefined);
}

export async function convexMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  args: Mutation["_args"]
): Promise<Mutation["_returnType"]> {
  const token = await getAuthToken();
  return fetchMutation(mutation, args, token ? { token } : undefined);
}
