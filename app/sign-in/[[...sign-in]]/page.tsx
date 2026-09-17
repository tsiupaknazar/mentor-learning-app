import { ClerkLoaded, ClerkLoading, SignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-grid bg-background p-4">
      {/* Clerk's widget loads asynchronously on the client — without this,
          there's a blank flash between navigating here and the form
          actually appearing. */}
      <ClerkLoading>
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#d9a441",
              colorBackground: "#171719",
              colorForeground: "#e8e8ea",
              colorInput: "#0f0f11",
              colorInputForeground: "#e8e8ea",
              borderRadius: "0.5rem",
            },
          }}
        />
      </ClerkLoaded>
    </div>
  );
}
