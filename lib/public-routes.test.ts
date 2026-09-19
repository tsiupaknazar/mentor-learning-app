import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTE_PATTERNS } from "./public-routes";

describe("PUBLIC_ROUTE_PATTERNS", () => {
  it("includes both landing pages, so neither is bounced to sign-in", () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain("/");
    expect(PUBLIC_ROUTE_PATTERNS).toContain("/uk");
  });

  it("keeps sign-in, sign-up and webhooks public", () => {
    expect(PUBLIC_ROUTE_PATTERNS).toEqual(expect.arrayContaining(["/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"]));
  });

  it("does not expose any app page", () => {
    const joined = PUBLIC_ROUTE_PATTERNS.join(" ");
    for (const page of ["/dashboard", "/learn", "/practice", "/projects", "/settings", "/api/evaluate"]) {
      expect(joined).not.toContain(page);
    }
  });
});
