import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Client-side wrapper for our own JSON API routes (POST + JSON in, JSON out).
 *
 * Why it exists: every call site used to do `if (!res.ok) throw new Error(
 * "<generic message>")`, so an expired session, the AI being down, being
 * offline and a plain bug all read identically. This classifies the failure
 * once, from the status code and the `{ error }` code the routes already
 * return (lib/route-utils.ts), so screens can say what to actually do.
 */

export type ApiErrorKind =
  | "unauthenticated" // session expired / signed out
  | "onboarding_incomplete"
  | "rate_limited"
  | "ai_unavailable" // AI not configured (503)
  | "ai_failed" // AI request failed or returned unusable output (502)
  | "invalid" // 4xx the caller caused
  | "not_found"
  | "server" // anything else 5xx
  | "network"; // no response at all (offline, DNS, CORS...)

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number | null,
    message?: string
  ) {
    super(message ?? kind);
    this.name = "ApiError";
  }
}

function classify(status: number, code: string | undefined): ApiErrorKind {
  if (status === 401 || code === "unauthenticated") return "unauthenticated";
  if (code === "onboarding_incomplete") return "onboarding_incomplete";
  if (status === 429) return "rate_limited";
  if (status === 503) return "ai_unavailable";
  if (status === 502) return "ai_failed";
  if (status === 404) {
    // Our routes answer a genuinely missing record with `{ error: "not_found" }`.
    // A bare 404 with no such body never comes from them: it's the auth
    // middleware turning away a request that has no session.
    return code === "not_found" ? "not_found" : "unauthenticated";
  }
  if (status >= 400 && status < 500) return "invalid";
  return "server";
}

/** POSTs `body` as JSON to `url` and returns the parsed JSON response. Throws ApiError on any failure. */
export async function apiFetch<T = unknown>(url: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  } catch {
    throw new ApiError("network", null);
  }

  // Tolerate an empty or non-JSON body: success responses may legitimately
  // carry none, and error pages (HTML from a proxy) must not mask the status.
  const text = await res.text().catch(() => "");
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    const code = (json as { error?: unknown } | undefined)?.error;
    throw new ApiError(classify(res.status, typeof code === "string" ? code : undefined), res.status);
  }
  return json as T;
}

/**
 * The message to show for a caught error. Failures that have a universal
 * remedy (sign in again, check your connection, wait for the AI) get that
 * advice; everything else falls back to the feature's own message, which
 * knows better what was being attempted.
 */
export function apiErrorMessage(err: unknown, t: Dictionary, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  switch (err.kind) {
    case "unauthenticated":
      return t.common.sessionExpired;
    case "network":
      return t.common.offline;
    case "rate_limited":
      return t.common.rateLimited;
    case "ai_failed":
      return t.common.aiBusy;
    case "ai_unavailable":
      return t.common.aiUnavailable;
    default:
      return fallback;
  }
}
