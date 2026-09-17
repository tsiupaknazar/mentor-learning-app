import Link from "next/link";
import { ArrowRight, GitBranch, Terminal } from "lucide-react";

import { landingPageJsonLd } from "@/lib/seo/json-ld";

const LOOP_STAGES = [
  "Understand",
  "Recall",
  "Practice",
  "Solve",
  "Explain",
  "Review",
  "Apply",
  "Revisit",
];

export default function LandingPage() {
  return (
    <div className="relative">
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
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start learning
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
              Practice-first, not lecture-first
            </p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Learn to code with a mentor who won&apos;t let you get away with
              &ldquo;it works.&rdquo;
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
              No lecture-and-quiz cycle. You attempt real problems, a strict senior-engineer
              reviewer breaks down what&apos;s actually wrong, and the next problem gets harder
              only once you&apos;ve earned it.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start learning
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <span className="font-mono text-xs text-muted-foreground">
                any topic — JS, React, SQL, Python, system design...
              </span>
            </div>
          </div>

          {/* Signature element: a real mentor review exchange, not a screenshot mockup */}
          <div className="rounded-lg border border-border bg-surface shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="font-mono text-xs text-muted-foreground">
                closures-exercise-04 · review
              </span>
            </div>
            <div className="space-y-4 p-4 font-mono text-[13px] leading-relaxed">
              <div>
                <span className="text-muted-foreground">you —</span>
                <p className="mt-1 text-foreground/90">
                  I used a var-hoisted counter here because it was easier.
                </p>
              </div>
              <div className="rounded-md border border-accent/25 bg-accent/6 p-3">
                <span className="text-accent">mentor —</span>
                <p className="mt-1 text-foreground/90">
                  Not sufficient. Easier in what sense — implementation time, runtime
                  complexity, or readability? Each variable in that loop shares one binding.
                  What happens to your callback when the loop finishes before it runs?
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">you —</span>
                <p className="mt-1 text-foreground/90">
                  ...it&apos;ll log the final value every time, not the value at creation.
                </p>
              </div>
              <div className="rounded-md border border-mastery-strong/25 bg-mastery-strong/6 p-3">
                <span className="text-mastery-strong">mentor —</span>
                <p className="mt-1 text-foreground/90">
                  Correct diagnosis. Now fix it with a per-iteration binding — don&apos;t just
                  swap in a library helper without saying why it solves this.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section className="border-t border-border bg-surface/40 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Every topic moves through the same loop
            </h2>
            <ol className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-8">
              {LOOP_STAGES.map((stage, i) => (
                <li key={stage} className="bg-surface p-4">
                  <span className="font-mono text-xs text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-1 text-sm font-medium">{stage}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Completion isn&apos;t &ldquo;you opened the lesson.&rdquo; It&apos;s demonstrated
              competence — measured across knowledge, application, debugging, explanation, and
              retention, separately, for every topic.
            </p>
          </div>
        </section>

        {/* Philosophy */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-5">
              <p className="font-mono text-xs text-danger">not this</p>
              <p className="mt-2 text-sm text-muted-foreground">
                A chatbot window with a nicer theme, answering whatever you type.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="font-mono text-xs text-danger">not this</p>
              <p className="mt-2 text-sm text-muted-foreground">
                A video course that marks a topic &ldquo;complete&rdquo; the moment you watch it.
              </p>
            </div>
            <div className="rounded-lg border border-accent/40 bg-accent/4 p-5">
              <p className="font-mono text-xs text-accent">this</p>
              <p className="mt-2 text-sm text-muted-foreground">
                A system that continuously measures what you can actually do, finds where your
                understanding breaks, and builds the next problem from that.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 font-mono text-xs text-muted-foreground">
          unsparing — practice-first programming education
        </div>
      </footer>
    </div>
  );
}
