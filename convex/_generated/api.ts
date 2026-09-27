/* eslint-disable */
/**
 * Local stand-in for Convex's own codegen output — see dataModel.ts's header
 * comment for why this is hand-written instead of generated. `anyApi` is the
 * same runtime value the real generated api.js exports (a Proxy that builds
 * `{ module: { function: reference } }` paths on the fly); the type layer on
 * top is built from Convex's own `ApiFromModules`/`FilterApi` against every
 * actual convex/*.ts module, so `api.users.completeOnboarding` etc. still
 * typecheck against real argument/return types instead of `any`.
 */
import { anyApi } from "convex/server";
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

import type * as achievements from "../achievements";
import type * as attempts from "../attempts";
import type * as concepts from "../concepts";
import type * as dashboard from "../dashboard";
import type * as exercises from "../exercises";
import type * as learningPaths from "../learningPaths";
import type * as mistakes from "../mistakes";
import type * as projects from "../projects";
import type * as sessions from "../sessions";
import type * as translations from "../translations";
import type * as users from "../users";

type FullApi = ApiFromModules<{
  achievements: typeof achievements;
  attempts: typeof attempts;
  concepts: typeof concepts;
  dashboard: typeof dashboard;
  exercises: typeof exercises;
  learningPaths: typeof learningPaths;
  mistakes: typeof mistakes;
  projects: typeof projects;
  sessions: typeof sessions;
  translations: typeof translations;
  users: typeof users;
}>;

export const api = anyApi as unknown as FilterApi<FullApi, FunctionReference<any, "public">>;
export const internal = anyApi as unknown as FilterApi<FullApi, FunctionReference<any, "internal">>;
