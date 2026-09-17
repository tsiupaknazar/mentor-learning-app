import { vi } from "vitest";

// "server-only" throws unconditionally unless resolved under Next's
// "react-server" bundler condition, which Vitest doesn't set — mocked to a
// no-op so lib/*.ts files that import it (gemini.ts, current-user.ts,
// convex-server.ts, learner-context.ts, email.ts, route-utils.ts) can be
// imported directly in tests.
vi.mock("server-only", () => ({}));
