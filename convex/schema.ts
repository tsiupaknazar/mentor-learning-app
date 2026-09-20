import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Relationship shape this schema is built to answer efficiently:
 *
 *   user -> learningPath -> topic -> exercise -> attempt -> mistake
 *
 * Deterministic bookkeeping (streaks, mastery aggregation, progress %) is
 * computed here in Convex mutations/queries, NOT by Gemini — see spec
 * section 20. Gemini output is only ever written after passing the Zod
 * validation in lib/schemas.ts.
 */

const skillLevel = v.union(
  v.literal("beginner"),
  v.literal("junior"),
  v.literal("intermediate"),
  v.literal("advanced")
);

const learningGoal = v.union(
  v.literal("first_job"),
  v.literal("interview_prep"),
  v.literal("improve_skills"),
  v.literal("learn_new_tech"),
  v.literal("production_skills"),
  v.literal("master_topic")
);

const learningStyle = v.union(
  v.literal("more_practice"),
  v.literal("balanced"),
  v.literal("more_theory")
);

const dailyTime = v.union(
  v.literal("15min"),
  v.literal("30min"),
  v.literal("1hr"),
  v.literal("2hr_plus")
);

const exerciseType = v.union(
  v.literal("multiple_choice"),
  v.literal("code_prediction"),
  v.literal("code_completion"),
  v.literal("debugging"),
  v.literal("refactoring"),
  v.literal("implementation"),
  v.literal("architecture_decision"),
  v.literal("explain_code"),
  v.literal("find_the_bug"),
  v.literal("compare_implementations"),
  v.literal("optimize_code"),
  v.literal("write_tests"),
  v.literal("review_code")
);

const exerciseDifficulty = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
  v.literal("interview"),
  v.literal("real_world")
);

const programmingLanguage = v.union(
  v.literal("javascript"),
  v.literal("typescript"),
  v.literal("html"),
  v.literal("css"),
  v.literal("python"),
  v.literal("sql")
);

const masteryScore = v.object({
  knowledge: v.number(),
  application: v.number(),
  debugging: v.number(),
  explanation: v.number(),
  retention: v.number(),
  overall: v.number(),
});

export default defineSchema({
  // -------------------------------------------------------------------
  // Identity & onboarding
  // -------------------------------------------------------------------
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    displayName: v.string(),
    level: skillLevel,
    learningGoal,
    learningStyle,
    dailyTime,
    onboardingComplete: v.boolean(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.string(), // "YYYY-MM-DD", app-computed, not AI-computed
    totalXp: v.number(),
    createdAt: v.number(),
    // UI + AI-generated content language. Optional so pre-migration rows
    // (which predate this field) fall back to "en" everywhere they're read.
    locale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
    // Gamification counters (section 26) — deterministic, app-computed, never
    // AI-scored. All optional + read-time-fallback-to-0, same pattern as
    // `locale` above: this app already had users before these existed.
    // See convex/lib/achievements.ts for what awards off each one.
    currentNoHintStreak: v.optional(v.number()), // consecutive correct, zero-hint, non-revealed attempts
    totalCorrectAttempts: v.optional(v.number()),
    totalMistakesResolved: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // -------------------------------------------------------------------
  // Learning paths & topics
  // -------------------------------------------------------------------
  learningPaths: defineTable({
    userId: v.id("users"),
    topic: v.string(), // the top-level subject, e.g. "JavaScript"
    title: v.string(),
    rationale: v.string(),
    knowledgeProfileSummary: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    // The language this row's title/rationale/knowledgeProfileSummary (and
    // its topics' title/summary) were actually generated in — NOT the
    // user's current locale preference, which can change later. Optional +
    // read-time fallback to "en", same pattern as every other field added
    // after this table already had rows. See contentTranslations below for
    // how mismatches against the learner's current locale get resolved.
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  }).index("by_user", ["userId"]),

  topics: defineTable({
    learningPathId: v.id("learningPaths"),
    userId: v.id("users"),
    parentTopicId: v.optional(v.id("topics")),
    externalId: v.string(), // stable id from the Gemini-generated tree, for prerequisite refs
    title: v.string(),
    summary: v.string(),
    prerequisiteExternalIds: v.array(v.string()),
    orderIndex: v.number(),
    // A free-form practice topic the learner added themselves ("CSS Flexbox
    // layouts" on the Practice board). It lives outside the curriculum: never
    // ordered, blocked or recommended, and not counted in path progress. Rows
    // created before this flag existed are recognised by their summary - see
    // convex/lib/curriculum.ts isAdHocTopic.
    adHoc: v.optional(v.boolean()),
  })
    .index("by_learning_path", ["learningPathId"])
    .index("by_user_and_external_id", ["userId", "externalId"]),

  topicProgress: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    mastery: masteryScore,
    attemptsCount: v.number(),
    lastAttemptAt: v.optional(v.number()),
    lastReviewedAt: v.optional(v.number()),
    nextReviewDue: v.optional(v.number()), // spaced repetition (section 13)
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("needs_review"),
      v.literal("mastered")
    ),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_user_and_topic", ["userId", "topicId"])
    .index("by_next_review", ["userId", "nextReviewDue"]),

  // -------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------
  sessions: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    objective: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    exercisesPlanned: v.number(),
    exercisesCompleted: v.number(),
    // Which flow started it. Only a completed "learn" session counts as
    // having learned the topic - a Practice drill must not (see
    // convex/lib/curriculum.ts). Sessions from before this field existed have
    // none, and are treated as "learn" so nobody's progress is taken away.
    mode: v.optional(v.union(v.literal("learn"), v.literal("practice"))),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_completed", ["userId", "completedAt"]),

  // -------------------------------------------------------------------
  // Exercises, attempts, mistakes
  // -------------------------------------------------------------------
  exercises: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    sessionId: v.optional(v.id("sessions")),
    externalId: v.string(),
    subtopic: v.string(),
    type: exerciseType,
    difficulty: exerciseDifficulty,
    // Optional: added after this table already had rows in some deployments
    // (e.g. this one) — making it required would fail Convex's schema
    // validation against every pre-existing exercise. Every NEW row from
    // convex/exercises.ts:saveGeneratedExercise always sets it; readers
    // fall back to "javascript" for older rows that predate this field.
    language: v.optional(programmingLanguage),
    title: v.string(),
    prompt: v.string(),
    starterCode: v.optional(v.string()),
    choices: v.optional(v.array(v.string())),
    testCases: v.optional(
      v.array(
        v.object({
          input: v.string(),
          expectedOutput: v.string(),
          description: v.optional(v.string()),
        })
      )
    ),
    referenceSolution: v.string(),
    createdAt: v.number(),
    // Same purpose as learningPaths.contentLocale above: the language this
    // exercise's title/subtopic/prompt/choices were actually generated in.
    // Optional + read-time fallback to "en" — every NEW row from
    // convex/exercises.ts:saveGeneratedExercise sets it; older rows predate
    // this field. See contentTranslations for how mismatches get resolved.
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_session", ["sessionId"]),

  attempts: defineTable({
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    topicId: v.id("topics"),
    submittedAnswer: v.string(),
    hintsUsed: v.number(),
    solutionRevealed: v.boolean(),
    result: v.union(
      v.literal("correct"),
      v.literal("partially_correct"),
      v.literal("incorrect")
    ),
    scores: v.object({
      correctness: v.number(),
      logic: v.number(),
      codeQuality: v.number(),
      bestPractices: v.number(),
      edgeCaseHandling: v.number(),
    }),
    feedback: v.object({
      whatYouDid: v.string(),
      problem: v.optional(v.string()),
      whyItMatters: v.optional(v.string()),
      hint: v.optional(v.string()),
      nextStep: v.string(),
      detectedMisconception: v.optional(v.string()),
      // Stable, English, language-independent identifier for the
      // detected misconception — see lib/schemas.ts's evaluationSchema
      // comment and convex/mistakes.ts's upsertMistake, which matches
      // recurrences on this instead of the locale-dependent prose above.
      detectedMisconceptionKey: v.optional(v.string()),
      mentorFollowUp: v.optional(v.string()),
    }),
    submittedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_exercise", ["exerciseId"])
    .index("by_user_and_topic", ["userId", "topicId"])
    // Range-scan a learner's recent attempts (activity calendar) without reading their whole history.
    .index("by_user_and_submitted", ["userId", "submittedAt"]),

  mistakes: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    description: v.string(), // the conceptual misconception, in plain language
    // Stable, English, language-independent identifier for this
    // misconception (see lib/schemas.ts's evaluationSchema.
    // detectedMisconceptionKey comment) — what upsertMistake actually
    // matches recurrences on, so a locale switch doesn't split one
    // recurring mistake into duplicates the way matching on `description`
    // alone did. Optional + read-time fallback to matching by description
    // — existing rows predate this field, and upsertMistake still falls
    // back to description-matching whenever either side lacks a key.
    key: v.optional(v.string()),
    firstDetectedAt: v.number(),
    lastDetectedAt: v.number(),
    occurrences: v.number(),
    status: v.union(v.literal("open"), v.literal("needs_review"), v.literal("resolved")),
    relatedAttemptIds: v.array(v.id("attempts")),
    // Consecutive correct attempts on this topic that did NOT reproduce
    // this mistake, since it was last detected. Reset to 0 whenever the
    // mistake recurs; once it crosses RESOLVE_THRESHOLD (convex/mistakes.ts)
    // the mistake is deterministically marked resolved. Optional + read-time
    // fallback to 0, same pattern as `exercises.language` above — existing
    // mistake rows predate this field.
    consecutiveCleanAttempts: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    // Same purpose as exercises.contentLocale above: the language this
    // mistake's `description` was actually generated in (from the
    // evaluate route's detectedMisconception). Optional + read-time
    // fallback to "en" — existing mistake rows predate this field.
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_topic", ["userId", "topicId"])
    .index("by_user_and_status", ["userId", "status"]),

  // -------------------------------------------------------------------
  // Projects (post-MVP per section 28, schema included now so the
  // core loop's data model doesn't need to change later)
  // -------------------------------------------------------------------
  projects: defineTable({
    userId: v.id("users"),
    topic: v.string(),
    title: v.string(),
    description: v.string(),
    level: skillLevel,
    // The project's CURRENT file state — starts as the initial scaffold
    // from the generated plan, and advances to whatever was submitted each
    // time a task is approved, so the next task picks up where the last
    // one left off instead of starting from a blank slate. Optional for
    // the same reason as `exercises.language` above — this field (and the
    // `code` -> `files` rename on codeSubmissions below) was added after
    // the table already existed; readers fall back to `[]`/an empty file
    // list for any project created before this field existed.
    files: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          language: programmingLanguage,
          content: v.string(),
        })
      )
    ),
    status: v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed")),
    createdAt: v.number(),
    // Same purpose as learningPaths.contentLocale above: the language this
    // project's title/description (and its tasks' title/requirements) were
    // actually generated in, independent of the learner's current locale.
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  }).index("by_user", ["userId"]),

  projectTasks: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    taskCode: v.string(), // e.g. "FE-142"
    title: v.string(),
    requirements: v.array(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_review"),
      v.literal("changes_requested"),
      v.literal("done")
    ),
    orderIndex: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"]),

  codeSubmissions: defineTable({
    userId: v.id("users"),
    projectTaskId: v.id("projectTasks"),
    files: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          content: v.string(),
        })
      )
    ),
    // Legacy shape from before the single-file -> multi-file rename. No
    // code writes this anymore; kept optional purely so a submission
    // created before that rename doesn't fail validation as an unexpected
    // field.
    code: v.optional(v.string()),
    submittedAt: v.number(),
  }).index("by_project_task", ["projectTaskId"]),

  reviews: defineTable({
    codeSubmissionId: v.id("codeSubmissions"),
    userId: v.id("users"),
    verdict: v.union(v.literal("approved"), v.literal("changes_requested")),
    summary: v.string(),
    comments: v.array(
      v.object({
        severity: v.union(v.literal("blocking"), v.literal("suggestion"), v.literal("nit")),
        comment: v.string(),
      })
    ),
    createdAt: v.number(),
  }).index("by_submission", ["codeSubmissionId"]),

  // -------------------------------------------------------------------
  // Gamification (secondary — section 26)
  // -------------------------------------------------------------------
  // `key` only — no `title`/`description` here. This table went unused
  // since it was first added (nothing ever awarded a row), so there's no
  // migration concern in redefining it: titles/descriptions are looked up
  // from the achievement key in the i18n dictionaries at render time
  // instead, same as every other piece of user-facing copy in the app —
  // storing English text on the row would freeze it in whatever locale
  // was active the moment it was earned.
  achievements: defineTable({
    userId: v.id("users"),
    key: v.string(), // e.g. "streak_7" — see convex/lib/achievements.ts
    earnedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_key", ["userId", "key"]),

  // -------------------------------------------------------------------
  // Translation cache
  // -------------------------------------------------------------------
  // AI-generated content (learning paths + their topics, projects + their
  // tasks) is written once in whatever locale was active at generation
  // time and stored as plain strings on those rows — there's no "live"
  // re-translation of the source of truth. When a learner's current locale
  // no longer matches a row's contentLocale, the UI calls a translate API
  // route which produces (and caches here) a translated copy, so the same
  // piece of content is only ever sent to Gemini once per target locale,
  // no matter how many times it's viewed afterward.
  contentTranslations: defineTable({
    sourceTable: v.union(
      v.literal("learningPaths"),
      v.literal("projects"),
      // Batched sourceTables: sourceId is the individual exercise/mistake
      // _id (each row here is one exercise or one mistake, translated
      // independently), unlike learningPaths/projects where sourceId is
      // the parent row and the whole bundle (topics/tasks) is cached as
      // one entry — the practice board and mistakes list are both
      // heterogeneous, freely-mixed lists rather than a single
      // always-viewed-together parent, so per-row caching is the better
      // fit here.
      v.literal("exercises"),
      v.literal("mistakes")
    ),
    sourceId: v.string(), // the learningPaths/projects/exercises/mistakes _id being translated
    locale: v.union(v.literal("en"), v.literal("uk")),
    // JSON-serialized bundle matching translatedLearningPathSchema,
    // translatedProjectSchema, translatedExerciseSchema, or
    // translatedMistakeSchema (lib/schemas.ts) depending on sourceTable —
    // stored as a string because Convex validators don't have a "shape
    // depends on a sibling field's value" union, and this is an internal
    // cache row, never read/written outside convex/translations.ts.
    fields: v.string(),
    createdAt: v.number(),
  }).index("by_source", ["sourceTable", "sourceId", "locale"]),
});
