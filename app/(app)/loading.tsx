import { Loader2 } from "lucide-react";

/**
 * Covers client-side navigation between pages under the (app) shell
 * (dashboard, learn, projects, practice, mistakes, progress, knowledge-map,
 * settings, and their dynamic sub-routes) that don't have a more specific
 * loading.tsx of their own — most of them fetch via Convex server-side on
 * navigation, and without this Next.js just leaves the previous page on
 * screen with no feedback until the new one is ready. Sits inside
 * app/(app)/layout.tsx's own render, so only the content area shows this;
 * the sidebar stays mounted and interactive throughout.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
    </div>
  );
}
