import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

import { GeminiConfigError, GeminiRequestError, GeminiValidationError } from "@/lib/gemini";
import { EmailConfigError, EmailRequestError } from "@/lib/email";
import { UnauthenticatedError, OnboardingIncompleteError } from "@/lib/current-user";

/** Converts a caught error into the appropriate JSON error response. Every API route funnels through this. */
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (err instanceof OnboardingIncompleteError) {
    return NextResponse.json({ error: "onboarding_incomplete" }, { status: 403 });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: "invalid_request", details: err.issues }, { status: 400 });
  }
  if (err instanceof GeminiConfigError) {
    return NextResponse.json({ error: "ai_not_configured", message: err.message }, { status: 503 });
  }
  if (err instanceof GeminiRequestError) {
    console.error("[gemini request error]", err.message, err.cause);
    return NextResponse.json({ error: "ai_request_failed", message: err.message }, { status: 502 });
  }
  if (err instanceof GeminiValidationError) {
    return NextResponse.json({ error: "ai_generation_failed", message: err.message }, { status: 502 });
  }
  if (err instanceof EmailConfigError) {
    return NextResponse.json({ error: "email_not_configured", message: err.message }, { status: 503 });
  }
  if (err instanceof EmailRequestError) {
    console.error("[feedback email error]", err.message, err.cause);
    return NextResponse.json({ error: "email_send_failed", message: err.message }, { status: 502 });
  }
  console.error(err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
