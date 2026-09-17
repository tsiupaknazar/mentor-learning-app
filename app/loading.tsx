import { Loader2 } from "lucide-react";

/**
 * The root layout (app/layout.tsx) does no async work itself, but every
 * route below it does — most importantly app/(app)/layout.tsx, which runs
 * a Clerk lookup plus two sequential Convex round trips before it can
 * render anything. Next.js only shows a fallback for that kind of
 * server-side wait when a loading.tsx exists somewhere in the segment's
 * ancestor chain; without one anywhere, the browser just keeps showing
 * whatever was on screen before the navigation (typically the sign-in
 * form, mid-redirect) until the entire chain resolves — the "empty
 * screen" this fixes. Root-level so it also covers /onboarding and any
 * other top-level route that doesn't have a more specific loading.tsx of
 * its own.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
    </div>
  );
}
