import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

import { api } from "@/convex/_generated/api";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { SidebarNav } from "@/components/learning/sidebar-nav";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { LocaleProvider } from "@/lib/i18n/locale-context";

/**
 * Every route under (app) requires a completed onboarding flow. This is
 * the one place that check lives, so individual pages don't each need to
 * re-derive it. `/onboarding` itself lives outside this route group, so
 * the redirect below can never loop.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const displayName = clerkUser?.firstName ?? clerkUser?.username ?? "there";

  await convexMutation(api.users.getOrCreateUser, { clerkId, email, displayName });
  const user = await convexQuery(api.users.getCurrentUser, { clerkId });

  if (!user) redirect("/sign-in");
  if (!user.onboardingComplete) redirect("/onboarding");

  return (
    <LocaleProvider userId={user._id} initialLocale={user.locale ?? "en"}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <SidebarNav />
        <div className="min-w-0 flex-1 overflow-y-auto">
          {/* Extra bottom padding keeps the last row (Submit / Next buttons) clear of the fixed feedback button. */}
          <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">{children}</div>
        </div>
      </div>
      <FeedbackButton />
    </LocaleProvider>
  );
}
