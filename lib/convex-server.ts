import "server-only";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { FunctionReference } from "convex/server";

/**
 * Every server-side (API route / route handler) call into Convex goes
 * through here so the Clerk session token is attached consistently and
 * `convex/auth.config.ts`'s row-level checks can trust `ctx.auth`.
 */
async function getAuthToken(): Promise<string | undefined> {
  const { getToken } = await auth();
  return (await getToken({ template: "convex" })) ?? undefined;
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
