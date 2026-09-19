import Link from "next/link";
import { ArrowRight, GitBranch, Terminal } from "lucide-react";

import { landingPageJsonLd } from "@/lib/seo/json-ld";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const LANDING_LOCALES: { locale: Locale; href: string; label: string }[] = [
  { locale: "en", href: "/", label: "EN" },
  { locale: "uk", href: "/uk", label: "UK" },
];

/**
 * The public landing page, in either language. Each language is its own
 * statically rendered route ("/" and "/uk") rather than one page that reads
 * request headers, so both stay cacheable and each has a crawlable URL to
 * point `hreflang` alternates at.
 */
export function LandingPage({ locale }: { locale: Locale }) {
  const t = dictionaries[locale].landing;

  return (
    // lang on the wrapper: the root <html lang> is fixed, so this is what
    // tells screen readers and search engines which language this page is in.
    <div className="relative" lang={locale}>
      {/* Structured data for search engines — safe to render server-side,
          no user data involved. See lib/seo/json-ld.ts. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingPageJsonLd()) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
            <Terminal className="h-4 w-4 text-accent" aria-hidden />
            unsparing
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex gap-1" role="group" aria-label="Language">
              {LANDING_LOCALES.map((l) => (
                <Link
                  key={l.locale}
                  href={l.href}
                  hrefLang={l.locale}
                  lang={l.locale}
                  aria-current={l.locale === locale ? "true" : undefined}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-xs transition-colors",
                    l.locale === locale
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              {t.signIn}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t.startLearning}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">{t.eyebrow}</p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{t.heroTitle}</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">{t.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t.startLearning}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <span className="font-mono text-xs text-muted-foreground">{t.topicsLine}</span>
            </div>
          </div>

          {/* Signature element: a real mentor review exchange, not a screenshot mockup */}
          <div className="rounded-lg border border-border bg-surface shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="font-mono text-xs text-muted-foreground">{t.reviewLabel}</span>
            </div>
            <div className="space-y-4 p-4 font-mono text-[13px] leading-relaxed">
              <div>
                <span className="text-muted-foreground">you —</span>
                <p className="mt-1 text-foreground/90">{t.reviewYou1}</p>
              </div>
              <div className="rounded-md border border-accent/25 bg-accent/6 p-3">
                <span className="text-accent">mentor —</span>
                <p className="mt-1 text-foreground/90">{t.reviewMentor1}</p>
              </div>
              <div>
                <span className="text-muted-foreground">you —</span>
                <p className="mt-1 text-foreground/90">{t.reviewYou2}</p>
              </div>
              <div className="rounded-md border border-mastery-strong/25 bg-mastery-strong/6 p-3">
                <span className="text-mastery-strong">mentor —</span>
                <p className="mt-1 text-foreground/90">{t.reviewMentor2}</p>
              </div>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section className="border-t border-border bg-surface/40 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t.loopHeading}</h2>
            <ol className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-8">
              {t.loopStages.map((stage, i) => (
                <li key={stage} className="bg-surface p-4">
                  <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-1 text-sm font-medium">{stage}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t.loopCaption}</p>
          </div>
        </section>

        {/* Philosophy */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-5">
              <p className="font-mono text-xs text-danger">{t.notThis1}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t.notThisText1}</p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="font-mono text-xs text-danger">{t.notThis2}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t.notThisText2}</p>
            </div>
            <div className="rounded-lg border border-accent/40 bg-accent/4 p-5">
              <p className="font-mono text-xs text-accent">{t.thisLabel}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t.thisText}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 font-mono text-xs text-muted-foreground">{t.footer}</div>
      </footer>
    </div>
  );
}
