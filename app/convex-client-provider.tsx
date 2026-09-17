"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl && process.env.NODE_ENV !== "test") {
  // Loud in dev, non-fatal in case this module is evaluated during a build
  // step that doesn't need it.
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and copy the URL into .env.local."
  );
}

const convex = new ConvexReactClient(convexUrl ?? "https://placeholder.convex.cloud");

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
