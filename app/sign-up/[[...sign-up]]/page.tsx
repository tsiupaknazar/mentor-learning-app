import { ClerkLoaded, ClerkLoading, SignUp } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-grid bg-background p-4">
      {/* Clerk's widget loads asynchronously on the client — without this,
          there's a blank flash between navigating here and the form
          actually appearing. */}
      <ClerkLoading>
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
      </ClerkLoading>
      <ClerkLoaded>
        <SignUp
          appearance={{
            variables: {
              colorPrimary: "#d9a441",
              colorBackground: "#171719",
              colorText: "#e8e8ea",
              colorInputBackground: "#0f0f11",
              colorInputText: "#e8e8ea",
              borderRadius: "0.5rem",
            },
          }}
        />
      </ClerkLoaded>
    </div>
  );
}
