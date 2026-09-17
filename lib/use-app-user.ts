"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

/** Client-side equivalent of lib/current-user.ts's server helper. */
export function useAppUser() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const appUser = useQuery(
    api.users.getCurrentUser,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  return {
    isLoading: !clerkLoaded || (Boolean(clerkUser) && appUser === undefined),
    clerkUser,
    user: appUser ?? null,
  };
}
