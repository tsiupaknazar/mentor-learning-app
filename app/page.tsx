import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: { en: "/", uk: "/uk" },
  },
};

export default function Page() {
  return <LandingPage locale="en" />;
}
