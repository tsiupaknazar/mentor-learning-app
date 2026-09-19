/**
 * Routes reachable without signing in - the single source for the auth
 * middleware (proxy.ts). Anything not matched here needs a session, so a new
 * public page (like the Ukrainian landing page at /uk) must be added here or
 * visitors are redirected to sign in.
 */
export const PUBLIC_ROUTE_PATTERNS = ["/", "/uk", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"];
