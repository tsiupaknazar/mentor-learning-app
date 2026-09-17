# SEO & analytics — what was added and how to turn it on

Everything here works with zero paid tools and needs no social accounts —
discovery comes from search engines and clean link previews, and traffic
gets measured with PostHog's free tier.

## 1. Set your real domain (do this first — almost everything below reads it)

In `.env.local` / your host's env settings:

```
NEXT_PUBLIC_SITE_URL=https://your-real-domain.com
```

No trailing slash. Until this is set to the real deploy URL, canonical tags,
OG/Twitter cards, `sitemap.xml`, and `robots.txt` all point at a placeholder
(`unsparing.example.com`) and won't do their job.

## 2. What's now automatic on every deploy

- **`/robots.txt`** (`app/robots.ts`) — allows the landing page, blocks
  `/api`, `/onboarding`, and every gated app route (they require a Clerk
  session anyway and have no unique content for a crawler).
- **`/sitemap.xml`** (`app/sitemap.ts`) — lists the indexable pages
  (`/`, `/sign-up`, `/sign-in`).
- **`/manifest.webmanifest`** (`app/manifest.ts`) — lets people add the app
  to their home screen and gives search engines a standard app description.
- **Favicon + Apple touch icon** (`app/icon.tsx`, `app/apple-icon.tsx`) —
  generated at build time from your brand colors, no image file to keep in
  sync.
- **Link-preview image** (`app/opengraph-image.tsx`, `app/twitter-image.tsx`)
  — a 1200×630 card in the site's own visual language, shown automatically
  when the link is pasted into Slack, Discord, iMessage, X, LinkedIn,
  WhatsApp, etc. This is the main lever for "even without socials": every
  cold link share still looks intentional.
- **Rich `<meta>` tags** (`app/layout.tsx`) — title template, description,
  keywords, canonical URL, Open Graph, Twitter card, and a
  `viewport`/`themeColor` export (required separately from `metadata` as of
  Next 14).
- **Structured data** (`lib/seo/json-ld.ts`, rendered in `app/page.tsx`) —
  `Organization` + `WebSite` + `SoftwareApplication` JSON-LD on the landing
  page, which is what makes Google eligible to show a richer search result
  (sitelinks search box, app info) instead of a bare blue link. No fake
  ratings or pricing were added — only fields that are actually true.

## 3. Google Search Console (free, ~10 minutes, no social account needed)

1. https://search.google.com/search-console → **Add property** → enter your
   domain.
2. Verify via **HTML tag**: copy just the `content="..."` value into
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and redeploy — `app/layout.tsx`
   already wires it into `<meta name="google-site-verification">` when
   that env var is set. (DNS verification works too if you'd rather not
   redeploy for this.)
3. Once verified, submit `https://your-domain.com/sitemap.xml` under
   **Sitemaps** so Google crawls the whole site instead of waiting to
   discover it.
4. Optional but free: do the same on [Bing Webmaster
   Tools](https://www.bing.com/webmasters) — it also feeds DuckDuckGo.

## 4. Verify the link-preview card actually renders right

Before relying on it: paste `https://your-domain.com` into
- https://www.opengraph.xyz (general OG preview)
- https://cards-dev.twitter.com/validator (X/Twitter card, if you ever do
  share there)

Both should show the 1200×630 dark card with the headline and mock review
snippet. If it shows a stale/blank image after a change, that's the
platform's own cache — most validators have a "scrape again" button.

## 5. PostHog (analytics — free tier, 1M events/month)

1. https://posthog.com → sign up (email only, no social login required) →
   create a project.
2. **Project settings → Project API key** → copy it into
   `NEXT_PUBLIC_POSTHOG_KEY`.
3. Set `NEXT_PUBLIC_POSTHOG_HOST` to `https://us.i.posthog.com` (US cloud)
   or `https://eu.i.posthog.com` (EU cloud) — whichever region you picked.
4. Redeploy. That's it — `lib/analytics/posthog-provider.tsx` is wired into
   `app/layout.tsx` and:
   - sends a pageview on every route change (App Router client-side
     navigations don't fire the events PostHog's own autocapture listens
     for, so this is done manually),
   - identifies a visitor by their Clerk user ID once they sign in, so you
     can see the signup → first-exercise → mastery funnel per real user
     instead of anonymous sessions,
   - resets identity on sign-out.

   Leave the key blank anywhere (e.g. local dev) and this whole thing is a
   no-op — no script loads, nothing is tracked.

5. Three funnel events are already wired in (using the helper above, not
   `posthog-js` directly):

   - `onboarding_completed` — `components/learning/onboarding-flow.tsx`,
     fired right before the redirect to `/dashboard`, with `level`, `goal`,
     `learningStyle`, `dailyTime`, `topic`.
   - `exercise_submitted` — `components/learning/session-runner.tsx`, fired
     after every `/api/evaluate` call, with `topic`, `subtopic`,
     `difficulty`, `exerciseType`, `result` (`correct` /
     `partially_correct` / `incorrect`), `hintsUsed`, `solutionRevealed`,
     `mode`.
   - `project_task_reviewed` — `components/learning/project-task-runner.tsx`,
     fired after every `/api/project/review` call, with `projectId`,
     `taskCode`, `verdict` (`approved` / `changes_requested`), `status`.
     Note: this fires per task, not once per fully-shipped project — the
     review API only returns the single task's new status, not whether it
     was the project's last remaining task. Wiring a true
     `project_shipped` event would mean having
     `convex/projects.ts#recordSubmissionAndReview` (and the
     `/api/project/review` route's response shape) surface an `allDone`
     flag — a small backend change, left out here since it touches request/
     response contracts rather than being pure analytics plumbing.

   To add more (e.g. mistake resolution, achievement unlocks), call `track`
   from wherever that action already happens client-side:

   ```ts
   import { track } from "@/lib/analytics/track";

   track("mistake_resolved", { mistakeId, method: "auto" | "manual" });
   ```

6. In PostHog itself, worth setting up once traffic starts: an **Insight**
   funnel for landing → sign-up → onboarding-complete, and the **Session
   recordings** toggle (also free tier) if you want to watch where people
   get stuck.

## 6. Vercel Analytics + Speed Insights (if deploying on Vercel)

`<Analytics />` and `<SpeedInsights />` from `@vercel/analytics` and
`@vercel/speed-insights` are now rendered in `app/layout.tsx`. They only
activate when actually running on Vercel infrastructure — page speed
(Core Web Vitals) is itself a Google ranking factor, so Speed Insights
doubles as an SEO signal, not just a dashboard. If you're not deploying to
Vercel, these two components no-op safely; delete the two `import`s and
JSX lines in `app/layout.tsx` if you'd rather not carry the dependency at
all.

## New env vars (added to `.env.example`)

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

## New dependencies

`posthog-js`, `@vercel/analytics`, `@vercel/speed-insights` — added to
`package.json`/`package-lock.json` in this drop. Run `npm install` after
applying the zip.

## Files touched

**New:** `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`,
`app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`,
`app/twitter-image.tsx`, `lib/analytics/posthog-provider.tsx`,
`lib/analytics/track.ts`, `lib/seo/site.ts`, `lib/seo/json-ld.ts`,
`lib/seo/og-image-element.tsx`, `SEO_ANALYTICS.md` (this file).

**Modified:** `app/layout.tsx` (metadata, viewport, analytics providers),
`app/page.tsx` (JSON-LD script tag), `components/learning/onboarding-flow.tsx`
(`onboarding_completed` event), `components/learning/session-runner.tsx`
(`exercise_submitted` event), `components/learning/project-task-runner.tsx`
(`project_task_reviewed` event), `.env.example`, `package.json`,
`package-lock.json`.

## What I verified vs. couldn't

Ran `tsc --noEmit` and `eslint` against every new/changed file — clean, with
the only remaining errors being the known pre-existing `AnyApi`-stub cascade
in unrelated files (sandbox `convex/_generated` is loosely typed here since
it's generated fresh by `npx convex dev`, which needs a real login).
`npm run build` in this sandbox fails only on fetching Google Fonts over the
network — a sandbox restriction, not a code issue; it'll build fine wherever
`fonts.googleapis.com` is reachable (Vercel, your machine, CI). I could not
verify the OG image renders pixel-correct without a live deploy to point a
validator at — the JSX/CSS subset `next/og`'s Satori renderer supports is
narrower than full CSS, so give it a look with the validators in section 4
once it's live.
