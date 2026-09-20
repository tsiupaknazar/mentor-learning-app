# Unsparing — AI programming learning platform

A practice-first programming mentor: diagnostic assessment → adaptive learning path →
AI-generated exercises → strict senior-engineer code review → mastery tracking →
recurring-mistake detection. Built with Next.js (App Router), TypeScript, Tailwind,
shadcn/ui, Convex, Clerk, and Gemini.

This implements the **core learning loop** (spec section 29) end to end. Projects and
Interview mode are stubbed with honest "not yet implemented" pages — see
[What's NOT built yet](#whats-not-built-yet).

## Fixed since first delivery

- **Stale default Gemini model names.** Shipped originally with `gemini-2.0-flash` /
  `gemini-2.0-flash-thinking-exp`, both since retired. Defaults are now
  `gemini-3.5-flash-lite` / `gemini-3.6-flash`. Google rotates model IDs every few
  months — if `/api/*` routes return a `502 ai_request_failed`, check
  https://ai.google.dev/gemini-api/docs/models and update `GEMINI_MODEL` /
  `GEMINI_REASONING_MODEL` in `.env.local`.
- **Intermittent `502 ai_generation_failed` on `/api/diagnostic/questions` and other AI
  routes.** Root cause: `responseMimeType: "application/json"` alone guarantees valid
  JSON but not which keys show up — Gemini would often omit an optional field (e.g.
  `codeSnippet`) instead of writing an explicit `null`, and Zod's `.nullable()` rejects a
  genuinely missing key. Fixed two ways: `lib/schemas.ts` now uses a `looseNullable()`
  helper (`.nullish().transform(v => v ?? null)`) that accepts either shape, and — the
  actual production-grade fix — `lib/gemini-schemas.ts` adds hand-written Gemini
  `responseSchema` definitions that constrain generation directly, per Google's own
  documented best practice. `lib/gemini.ts` also now distinguishes "the Gemini API call
  itself failed" (`GeminiRequestError`, e.g. bad model name) from "Gemini responded but
  the JSON didn't validate" (`GeminiValidationError`), and logs the raw response on
  failure so future issues are diagnosable from the server log instead of a bare 502.
- **`502` on `/api/learning-path` specifically.** This route wasn't given a
  `responseSchema` in the first fix, since the topic tree is recursive and Gemini's
  schema language has no `$ref`/recursion. Without one, Gemini invented its own
  top-level key names (`path` instead of `topics`) and dropped `children` at deeper
  nesting levels. Fixed by hand-writing the tree 3 levels deep in
  `lib/gemini-schemas.ts` — matching the "max depth 3" the product spec already
  specifies — and making `lib/schemas.ts`'s `prerequisiteIds`/`children` default to
  `[]` when Gemini omits them on a leaf node, which is the semantically correct
  reading of "no key" anyway.
- **Code editor shown for "predict the output" / "explain this code" exercises.**
  Every non-multiple-choice exercise with `starterCode` was rendered as an editable
  code box whose *contents* were submitted as the answer — meaningless for exercise
  types where the learner is supposed to read code and explain/predict something
  about it, not edit it. `components/learning/session-runner.tsx` now splits exercise
  types into `CODE_ANSWER_TYPES` (debugging, refactoring, implementation,
  code_completion, optimize_code, write_tests — the code editor's contents are the
  answer) and `READ_ONLY_CODE_TYPES` (code_prediction, explain_code, find_the_bug,
  compare_implementations, review_code — the code is shown via the new
  `components/learning/read-only-code.tsx` and the answer is a separate text field).
- **Added a "quick concept" theory step** (spec section 6: "Quick concept" +
  "Example"). `POST /api/concept` generates a short, non-graded explanation + key
  points + one code example for a topic (`lib/schemas.ts`'s `conceptSchema`,
  `lib/gemini-schemas.ts`'s `conceptGeminiSchema`, `lib/prompts.ts`'s
  `buildConceptPrompt`). Shown once before the first exercise in a session
  (`components/learning/concept-panel.tsx`), and re-openable at any point during the
  session via a "Show theory" toggle for revision — it isn't persisted to Convex since
  it's supplementary, not graded, and cheap enough to regenerate on request.
- **Diagnostic was too shallow to place someone across a broad topic.** A fixed 5-6
  questions can't cover a whole topic like "JavaScript" — you'd get a placement based on
  a handful of lucky/unlucky guesses. `lib/prompts.ts`'s `buildDiagnosticPrompt` now has
  the model enumerate the topic's actual subtopics first (8-12 for a broad subject, 4-6
  for a narrow one) and guarantees at least one question per subtopic, landing around
  10-16 questions for a broad topic instead of a flat 5-6. `lib/schemas.ts`'s
  `diagnosticSetSchema` bounds moved from 3-8 to 6-20 accordingly, generation moved to
  the stronger "reasoning" model tier (planning non-redundant coverage is a harder task
  than picking 5 questions), and the onboarding UI now shows an answered/total progress
  bar so a longer diagnostic doesn't feel like an undifferentiated wall of cards.

## Verification status

This was built in a sandbox with no access to Clerk, Convex, or Google's Gemini API, so
none of it could be run live. What *was* verified in that sandbox:

- `npm install` succeeds with the pinned dependency versions.
- `npx tsc --noEmit` passes with **zero errors**, checked against a schema-bound stub of
  Convex's generated types (built with Convex's own `DataModelFromSchemaDefinition` /
  `ApiFromModules` utilities, not a loose `any`) — so this actually caught and fixed real
  bugs, e.g. a `null` vs `undefined` mismatch between Zod's `.nullable()` and Convex's
  `v.optional()` at the exercise/hint/evaluate API boundary.
- `npx eslint .` passes clean.
- `npm run build` completes a full webpack production build and generates all 19 routes.
  The only errors at that stage were `@clerk/clerk-react: invalid publishableKey`, from a
  placeholder key — expected, since no real Clerk project exists in this sandbox. Swap in
  real keys and this resolves.

What was **not** and **cannot** be verified without live services: actual Convex
mutations/queries executing against a real deployment, Clerk auth actually issuing
sessions, and Gemini actually returning JSON that matches the Zod schemas (the prompts are
written to make this reliable, and `lib/gemini.ts` has an automatic repair-retry for when
it isn't, but the only real test is running it).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Clerk** (auth)
   - Create an application at https://dashboard.clerk.com.
   - Copy the publishable + secret keys into `.env.local` (copy `.env.example` first).
   - In the Clerk dashboard: **JWT Templates → New template → Convex**. This creates the
     template `convex/auth.config.ts` expects. Copy the "Issuer" URL shown there.

3. **Convex** (database/backend)

   ```bash
   npx convex dev
   ```

   This logs you into Convex, creates a project, generates `convex/_generated/*`
   (gitignored — see `convex/_generated/README.md`), and gives you a deployment URL.
   Copy that into `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

   Then set the Clerk issuer URL as a **Convex** environment variable (not a Next.js one —
   Convex functions run in their own environment):

   ```bash
   npx convex env set CLERK_ISSUER_URL https://your-issuer-url.clerk.accounts.dev
   ```

4. **Gemini** (AI generation/evaluation)
   - Get an API key at https://aistudio.google.com/apikey.
   - Set `GEMINI_API_KEY` in `.env.local`. Never expose this to the browser — every call
     to Gemini happens in `lib/gemini.ts`, which is marked `server-only` and is only ever
     imported from `app/api/*/route.ts` files.

5. **Run it**

   ```bash
   npm run dev        # in one terminal
   npx convex dev      # in another, keeps functions synced
   ```

## Architecture notes

- **AI is untrusted input, not application state.** Every Gemini response is parsed and
  validated against a Zod schema in `lib/schemas.ts` before it touches the database or the
  browser (`lib/gemini.ts`'s `generateStructured`). One repair-retry is attempted
  automatically if the first response fails validation; a second failure surfaces as a
  typed `GeminiValidationError` that API routes turn into a `502` the UI can retry.
- **Deterministic logic never goes through the AI.** Mastery scoring
  (`convex/lib/mastery.ts`), spaced-repetition scheduling, streaks, XP, and difficulty
  selection (`lib/difficulty.ts`) are all plain, testable TypeScript. Gemini only ever
  supplies the qualitative pieces (exercise content, per-attempt scores 0–100, feedback
  text) — the app decides what those numbers *mean* for progression.
- **Compact learner context, not full history.** `lib/learner-context.ts` /
  `convex/dashboard.ts:getLearnerContext` build the small `LearnerContext` object
  (weak/strong topic titles, recurring mistake descriptions, a rolling performance
  number) that's actually sent to Gemini — never the full attempt log. This is both a
  cost control and a prompt-quality choice (a shorter, curated context outperforms a
  wall of raw history).
- **The reference solution never reaches the browser.** `app/api/exercise/route.ts`
  strips it before responding; `app/api/evaluate/route.ts` and `app/api/hint/route.ts`
  re-fetch it server-side from Convex by ID.
- **The path decides what's next; practising never advances it.** All of the rules live in
  `convex/lib/curriculum.ts` (pure, unit-tested) and are applied by `getActiveLearningPath`,
  `getTopic` and the dashboard through one loader (`convex/lib/curriculumData.ts`):
  - A topic is **passed** when it is mastered *or* a **Learn** session has been finished on
    it. Sessions record their `mode`, and a Practice drill never counts; sessions from before
    the field existed count as Learn so nobody loses progress.
  - The path's own order is authoritative, because the AI's `prerequisiteIds` are often empty.
    **Beginners follow it strictly** (a topic opens only when everything before it is passed);
    everyone else can work on any topic whose named prerequisites they've passed. Prerequisites
    that point at the topic itself or a *later* topic are ignored (they would deadlock the path).
  - "What's next" is the first topic in path order that isn't passed — never blocked by
    construction, so there's always a next step. A due spaced-repetition review takes priority,
    but only for topics that were actually learned.
  - Blocked topics can be neither learned nor practised: `/api/exercise`, `/api/practice-problems`,
    `/api/evaluate`, `/api/hint`, both practice pages and the board all enforce it.
  - Topics a learner adds on the Practice board are **ad-hoc sandboxes** (`topics.adHoc`): outside
    the path, never blocked or recommended, and not counted in progress. A title that matches an
    existing path topic returns that topic instead, so the sandbox can't be used to dodge a lock.
- **Model tiering.** `lib/gemini.ts` takes a `tier: "fast" | "reasoning"` parameter so
  cheap generations (hints, single exercises) can use a lighter model while full code
  review and diagnostic scoring use a stronger one — see `GEMINI_MODEL` /
  `GEMINI_REASONING_MODEL` in `.env.example`.

## What's implemented

The full loop from spec section 29: topic selection → optional AI diagnostic →
AI-generated learning path → learning session → AI-generated exercise → code editor /
answer submission → strict-mentor AI review → mastery update → recurring-mistake
tracking → next exercise (or a harder one) → dashboard "what to do next".

Also: progressive 3-level hints that never reveal the full solution until requested,
spaced-repetition scheduling that resurfaces due topics on the dashboard, a knowledge map
with the five-axis mastery breakdown (knowledge/application/debugging/explanation/
retention) per topic, editable learning preferences in Settings, a short "quick concept"
theory step before each session with an on-demand "Show theory" toggle for revision
(spec section 6), and **Projects** (spec section 14): generate a project scoped to a
topic and level, broken into ticket-style tasks with concrete requirements
(`POST /api/project`), submit code per task and get a Team-Lead-style AI review —
approved/changes-requested with severity-tagged comments (`POST /api/project/review`),
resubmit on changes-requested with the model checking whether previous comments were
actually addressed, project/task status tracked deterministically from the review
verdict (`convex/projects.ts`). Projects are genuinely **multi-file/multi-language**:
Gemini decides the project's actual file manifest (e.g. index.html + styles.css +
script.js for a UI project, vs. a single file for a pure-algorithms one), the task
editor is a tabbed `MultiFileEditor` with correct syntax highlighting per file and a
live sandboxed-iframe preview when an HTML file is present, and a task's starting files
are the codebase state left by the last *approved* task — not a blank slate every time.
Exercises also carry a `language` field now (not force-JS), so a CSS or TypeScript
exercise renders correctly.

Also: **Practice** (`/practice`) is now a distinct page from **Learn** (`/learn`) — Learn
browses your AI-generated curriculum tree in order; Practice lets you jump straight into
any topic/language you want to drill (categorized presets across JS/TS/HTML & CSS/React/
backend, plus a free-text option), via `findOrCreateAdHocTopic` in
`convex/learningPaths.ts`, which reuses the exact same session flow and mastery tracking
— it just doesn't require navigating the structured tree first.
- **Convex schema push failure: "missing the required field `language`"** on pre-existing
  `exercises` rows. Not a code bug — Convex validates every existing document against the
  schema on push, and any exercise generated before this session added the `language`
  field genuinely doesn't have it. Fixed by making `language` `v.optional(...)` in the
  `exercises` table (`convex/schema.ts`) so old rows validate as-is with no manual
  migration needed, while `saveGeneratedExercise`'s argument validator keeps it required
  (every new exercise always has one) and the two places that read an existing row back —
  `/api/evaluate` and `/api/hint` — fall back to `"javascript"` if it's missing. Worth
  knowing for any future required field added to an already-populated table: either
  make it optional with a read-time fallback like this, or write a real migration.

## What's NOT built yet

- **Interview mode** — deliberately out of MVP scope per spec section 28. Would reuse
  `lib/prompts.ts`'s `MENTOR_PERSONA` and `lib/gemini.ts`'s `generateText` for the
  multi-turn conversation; not built.

Smaller things worth knowing about:

- Project level (beginner/junior/intermediate/advanced) is chosen by the learner in the
  "start a project" form (defaulting to their own level), not decided by Gemini — same
  reasoning as exercise difficulty in `lib/difficulty.ts`: deterministic where it can be.
- The in-browser "Run" button in the code editor executes in a sandboxed Web Worker with
  a 3s timeout and captures `console.log` output for the learner's own iteration — it is
  **not** the grader. Grading is always the AI review in `/api/evaluate` (exercises) or
  `/api/project/review` (project tasks), per spec section 9. It does not auto-check
  `testCases` client-side.
- Syntax highlighting covers JavaScript, TypeScript, HTML, CSS, Python, and SQL
  (`lib/code-languages.ts`) — Python/SQL packages are wired up but nothing in the prompts
  currently asks Gemini to generate Python or SQL exercises/projects; extending
  `buildExercisePrompt`/`buildProjectPlanPrompt`'s topic examples to mention them is a
  small follow-up, not a redesign.
- Achievements (`achievements` table) exist in the schema but nothing awards them yet —
  XP is awarded, but badges aren't.

## Project structure

```
app/
  (app)/                 authenticated shell (sidebar) + all main screens
  api/                   Gemini-calling route handlers (diagnostic, learning-path,
                          exercise, evaluate, hint, concept, project, project/review)
  onboarding/             goal/level/topic/style/time -> optional diagnostic -> path gen
  sign-in/ sign-up/       Clerk
convex/
  schema.ts               full data model (spec section 21)
  users.ts learningPaths.ts exercises.ts attempts.ts mistakes.ts sessions.ts dashboard.ts
  projects.ts              project/task creation, submission + review recording
  lib/mastery.ts           deterministic mastery math + spaced-repetition scheduling
components/
  ui/                      shadcn/ui primitives
  learning/                onboarding flow, session runner, code editor, multi-file
                            editor, feedback panel, concept panel, project task runner,
                            review panel, practice picker
lib/
  gemini.ts                server-only Gemini wrapper (schema-validated, retry-on-fail)
  gemini-schemas.ts         Gemini-native responseSchema definitions (constrains generation)
  schemas.ts                Zod schemas for every AI payload
  prompts.ts                mentor + team-lead personas and all prompt builders
  difficulty.ts             deterministic difficulty selection
  code-languages.ts         CodeMirror language extension mapping (JS/TS/HTML/CSS/Python/SQL)
types/domain.ts             shared TypeScript types
```
