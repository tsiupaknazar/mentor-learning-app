import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handleRouteError } from "@/lib/route-utils";
import { GeminiConfigError, GeminiRequestError, GeminiValidationError } from "@/lib/gemini";
import { EmailConfigError, EmailRequestError } from "@/lib/email";
import { UnauthenticatedError, OnboardingIncompleteError } from "@/lib/current-user";

async function statusAndBody(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe("handleRouteError", () => {
  it("maps UnauthenticatedError to 401", async () => {
    const { status, body } = await statusAndBody(handleRouteError(new UnauthenticatedError()));
    expect(status).toBe(401);
    expect(body).toEqual({ error: "unauthenticated" });
  });

  it("maps OnboardingIncompleteError to 403", async () => {
    const { status, body } = await statusAndBody(handleRouteError(new OnboardingIncompleteError()));
    expect(status).toBe(403);
    expect(body).toEqual({ error: "onboarding_incomplete" });
  });

  it("maps a ZodError to 400 with issues", async () => {
    const zodError = z.object({ topic: z.string() }).safeParse({}).error as z.ZodError;
    const { status, body } = await statusAndBody(handleRouteError(zodError));
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_request");
    expect(body.details).toBeInstanceOf(Array);
  });

  it("maps GeminiConfigError to 503", async () => {
    const { status, body } = await statusAndBody(
      handleRouteError(new GeminiConfigError("no key"))
    );
    expect(status).toBe(503);
    expect(body).toEqual({ error: "ai_not_configured", message: "no key" });
  });

  it("maps GeminiRequestError to 502 and logs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await statusAndBody(
      handleRouteError(new GeminiRequestError("bad model", new Error("cause")))
    );
    expect(status).toBe(502);
    expect(body).toEqual({ error: "ai_request_failed", message: "bad model" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("maps GeminiValidationError to 502", async () => {
    const { status, body } = await statusAndBody(
      handleRouteError(new GeminiValidationError("bad shape", { issue: true }))
    );
    expect(status).toBe(502);
    expect(body).toEqual({ error: "ai_generation_failed", message: "bad shape" });
  });

  it("maps EmailConfigError to 503", async () => {
    const { status, body } = await statusAndBody(
      handleRouteError(new EmailConfigError("not configured"))
    );
    expect(status).toBe(503);
    expect(body).toEqual({ error: "email_not_configured", message: "not configured" });
  });

  it("maps EmailRequestError to 502 and logs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await statusAndBody(
      handleRouteError(new EmailRequestError("send failed", "cause"))
    );
    expect(status).toBe(502);
    expect(body).toEqual({ error: "email_send_failed", message: "send failed" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("maps anything else to 500 and logs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await statusAndBody(handleRouteError(new Error("mystery")));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
