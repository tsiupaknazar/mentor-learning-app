import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

import { api } from "@/convex/_generated/api";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { OnboardingFlow } from "@/components/learning/onboarding-flow";
import { LocaleProvider } from "@/lib/i18n/locale-context";

export default async function OnboardingPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const displayName = clerkUser?.firstName ?? clerkUser?.username ?? "there";

  await convexMutation(api.users.getOrCreateUser, { clerkId, email, displayName });
  const user = await convexQuery(api.users.getCurrentUser, { clerkId });
  if (!user) redirect("/sign-in");
  if (user.onboardingComplete) redirect("/dashboard");

  return (
    <LocaleProvider userId={user._id} initialLocale={user.locale ?? "en"}>
      <div className="mx-auto min-h-screen max-w-2xl px-6 py-16">
        <OnboardingFlow userId={user._id} />
      </div>
    </LocaleProvider>
  );
}
