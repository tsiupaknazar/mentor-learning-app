import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: { absolute: "Unsparing — вчіться, практикуючись; рецензія як у продакшн-коді" },
  description:
    "Ментор із програмування, що вчить на практиці: діагностика, адаптивний навчальний шлях і суворий рев’ювер-сеньйор для кожної вправи.",
  alternates: {
    canonical: "/uk",
    languages: { en: "/", uk: "/uk" },
  },
  openGraph: { locale: "uk_UA", alternateLocale: "en_US", url: "/uk" },
};

export default function UkrainianLandingPage() {
  return <LandingPage locale="uk" />;
}
