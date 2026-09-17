"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

/**
 * Wraps the app with PostHog. Deliberately opt-in via env var: with no key
 * set (e.g. local dev, or a fork that doesn't want analytics), this renders
 * children untouched and no script ever loads — no silent tracking.
 *
 * `capture_pageview` is off in init(); App Router doesn't fire the events
 * PostHog's autocapture listens for on client-side navigations, so
 * pageviews are sent manually from `PageviewTracker` on every pathname or
 * query-string change instead.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!posthogKey || initialized) return;
    posthog.init(posthogKey, {
      api_host: posthogHost,
      ui_host: "https://us.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
    initialized = true;
  }, []);

  if (!posthogKey) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentifyOnSignIn />
      {children}
    </PHProvider>
  );
}

function PageviewTracker() {
  const client = usePostHog();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!client || !pathname) return;
    const query = searchParams.toString();
    client.capture("$pageview", {
      $current_url: query ? `${window.location.origin}${pathname}?${query}` : `${window.location.origin}${pathname}`,
    });
  }, [client, pathname, searchParams]);

  return null;
}

/**
 * Links anonymous pre-signup activity to a real person once Clerk confirms
 * a session, and resets identity on sign-out so the next visitor on a
 * shared machine doesn't inherit the previous person's events. Guarded by
 * a ref so it only fires on actual sign-in/sign-out transitions, not on
 * every render while Clerk is still loading.
 */
function IdentifyOnSignIn() {
  const client = usePostHog();
  const { user, isSignedIn, isLoaded } = useUser();
  const lastSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!client || !isLoaded) return;
    if (isSignedIn && user && lastSignedIn.current !== true) {
      client.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? undefined,
      });
      lastSignedIn.current = true;
    } else if (!isSignedIn && lastSignedIn.current === true) {
      client.reset();
      lastSignedIn.current = false;
    } else if (lastSignedIn.current === null) {
      lastSignedIn.current = Boolean(isSignedIn);
    }
  }, [client, isLoaded, isSignedIn, user]);

  return null;
}
