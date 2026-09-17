import "server-only";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { convexQuery } from "@/lib/convex-server";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in.");
  }
}

export class OnboardingIncompleteError extends Error {
  constructor() {
    super("Onboarding has not been completed.");
  }
}

/** Resolves the current Clerk session to its Convex `users` row. Throws if unauthenticated or unknown. */
export async function requireCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new UnauthenticatedError();

  const user = await convexQuery(api.users.getCurrentUser, { clerkId });
  if (!user) throw new UnauthenticatedError();
  return user;
}
