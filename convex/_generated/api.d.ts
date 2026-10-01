/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievements from "../achievements.js";
import type * as attempts from "../attempts.js";
import type * as concepts from "../concepts.js";
import type * as dashboard from "../dashboard.js";
import type * as exercises from "../exercises.js";
import type * as learningPaths from "../learningPaths.js";
import type * as lib_achievements from "../lib/achievements.js";
import type * as lib_bands from "../lib/bands.js";
import type * as lib_curriculum from "../lib/curriculum.js";
import type * as lib_curriculumData from "../lib/curriculumData.js";
import type * as lib_mastery from "../lib/mastery.js";
import type * as lib_streaks from "../lib/streaks.js";
import type * as lib_topicOrder from "../lib/topicOrder.js";
import type * as lib_xp from "../lib/xp.js";
import type * as mistakes from "../mistakes.js";
import type * as projects from "../projects.js";
import type * as sessions from "../sessions.js";
import type * as translations from "../translations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievements: typeof achievements;
  attempts: typeof attempts;
  concepts: typeof concepts;
  dashboard: typeof dashboard;
  exercises: typeof exercises;
  learningPaths: typeof learningPaths;
  "lib/achievements": typeof lib_achievements;
  "lib/bands": typeof lib_bands;
  "lib/curriculum": typeof lib_curriculum;
  "lib/curriculumData": typeof lib_curriculumData;
  "lib/mastery": typeof lib_mastery;
  "lib/streaks": typeof lib_streaks;
  "lib/topicOrder": typeof lib_topicOrder;
  "lib/xp": typeof lib_xp;
  mistakes: typeof mistakes;
  projects: typeof projects;
  sessions: typeof sessions;
  translations: typeof translations;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
