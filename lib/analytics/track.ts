"use client";

import posthog from "posthog-js";

/**
 * Fire a custom PostHog event. Safe to call unconditionally — it's a no-op
 * if analytics isn't configured (NEXT_PUBLIC_POSTHOG_KEY unset) or hasn't
 * finished initializing yet.
 *
 * Not wired into any components yet. Reach for this at the moments that
 * actually matter for a launch funnel, e.g.:
 *
 *   track("onboarding_completed", { level, goal });
 *   track("exercise_submitted", { topic, difficulty, passed });
 *   track("project_task_approved", { projectId });
 */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}
