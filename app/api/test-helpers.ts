/**
 * Shared scaffolding for app/api/*\/route.test.ts files. Route handlers are
 * plain `(req: Request) => Promise<Response>` functions in the App Router,
 * so they're tested by importing `POST` directly and calling it with a real
 * `Request` — no Next.js server needed.
 *
 * Each test file still needs its own `vi.mock(...)` calls (Vitest hoists
 * them per-file, so they can't be centralized here) — the pattern is to
 * mock only the one function actually being replaced via `importOriginal`,
 * so the real error classes (UnauthenticatedError, GeminiConfigError, etc.)
 * stay intact for handleRouteError's `instanceof` checks to keep working.
 */

export function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/test-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function statusAndBody(res: Response) {
  return { status: res.status, body: await res.json() };
}

export const FAKE_USER = {
  _id: "user1",
  clerkId: "clerk_1",
  email: "learner@example.com",
  displayName: "Learner",
  level: "junior" as const,
  learningGoal: "improve_skills" as const,
  learningStyle: "balanced" as const,
  dailyTime: "30min" as const,
  onboardingComplete: true,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: "2024-01-01",
  totalXp: 0,
  locale: "en" as const,
};

export const FAKE_LEARNER_CONTEXT = {
  level: "junior" as const,
  learningGoal: "improve_skills" as const,
  learningStyle: "balanced" as const,
  locale: "en" as const,
  currentTopics: [],
  weakTopics: [],
  strongTopics: [],
  recurringMistakes: [],
  recentPerformance: 50,
  pathSubject: null,
};
