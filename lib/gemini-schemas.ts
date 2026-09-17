import { SchemaType, type Schema } from "@google/generative-ai";

/**
 * Hand-written Gemini `responseSchema` definitions paired with each Zod
 * schema in lib/schemas.ts. `responseMimeType: "application/json"` alone
 * only constrains Gemini to emit *valid JSON* — it does not force which
 * keys show up, so the model would routinely omit a field instead of
 * writing an explicit `null` for it (confirmed in Google's own docs:
 * "By default, fields are optional, meaning the model can populate the
 * fields or skip them"). That was the root cause of intermittent 502s here.
 *
 * The fix: every field below is listed in `required` (so the key always
 * appears) and `nullable: true` where the value itself can legitimately be
 * absent (so the model writes `null` instead of dropping the key). This is
 * Gemini's own OpenAPI-subset schema language, NOT standard JSON Schema —
 * it can't be auto-derived from the Zod schemas, hence hand-written here.
 *
 * Not attempted for `learningPathSchema`'s topic tree: see the comment
 * further down, it gets a bounded-depth version instead of true recursion.
 */

export const diagnosticSetGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    topic: { type: SchemaType.STRING },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          type: {
            type: SchemaType.STRING,
            enum: ["knowledge", "code_reading", "debugging", "implementation", "explanation"],
          },
          subtopic: { type: SchemaType.STRING },
          prompt: { type: SchemaType.STRING },
          codeSnippet: { type: SchemaType.STRING, nullable: true },
          choices: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            nullable: true,
          },
        },
        required: ["id", "type", "subtopic", "prompt", "codeSnippet", "choices"],
      },
    },
  },
  required: ["topic", "questions"],
};

export const knowledgeProfileGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    topic: { type: SchemaType.STRING },
    subtopics: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          subtopic: { type: SchemaType.STRING },
          band: { type: SchemaType.STRING, enum: ["weak", "medium", "strong"] },
          rationale: { type: SchemaType.STRING },
        },
        required: ["subtopic", "band", "rationale"],
      },
    },
    suggestedLevel: {
      type: SchemaType.STRING,
      enum: ["beginner", "junior", "intermediate", "advanced"],
    },
    summary: { type: SchemaType.STRING },
  },
  required: ["topic", "subtopics", "suggestedLevel", "summary"],
};

const EXERCISE_TYPES = [
  "multiple_choice",
  "code_prediction",
  "code_completion",
  "debugging",
  "refactoring",
  "implementation",
  "architecture_decision",
  "explain_code",
  "find_the_bug",
  "compare_implementations",
  "optimize_code",
  "write_tests",
  "review_code",
];
const EXERCISE_DIFFICULTIES = ["easy", "medium", "hard", "interview", "real_world"];
const PROGRAMMING_LANGUAGES = ["javascript", "typescript", "html", "css", "python", "sql"];

export const exerciseGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    topic: { type: SchemaType.STRING },
    subtopic: { type: SchemaType.STRING },
    type: { type: SchemaType.STRING, enum: EXERCISE_TYPES },
    difficulty: { type: SchemaType.STRING, enum: EXERCISE_DIFFICULTIES },
    language: { type: SchemaType.STRING, enum: PROGRAMMING_LANGUAGES },
    title: { type: SchemaType.STRING },
    prompt: { type: SchemaType.STRING },
    starterCode: { type: SchemaType.STRING, nullable: true },
    choices: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
    testCases: {
      type: SchemaType.ARRAY,
      nullable: true,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          input: { type: SchemaType.STRING },
          expectedOutput: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING, nullable: true },
        },
        required: ["input", "expectedOutput", "description"],
      },
    },
    referenceSolution: { type: SchemaType.STRING },
  },
  required: [
    "id",
    "topic",
    "subtopic",
    "type",
    "difficulty",
    "language",
    "title",
    "prompt",
    "starterCode",
    "choices",
    "testCases",
    "referenceSolution",
  ],
};

/** A batch of exercises for the Practice board — same shape as a single exercise, just wrapped in an array. */
export const practiceProblemSetGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    problems: { type: SchemaType.ARRAY, items: exerciseGeminiSchema },
  },
  required: ["problems"],
};

export const evaluationGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    result: { type: SchemaType.STRING, enum: ["correct", "partially_correct", "incorrect"] },
    scores: {
      type: SchemaType.OBJECT,
      properties: {
        correctness: { type: SchemaType.NUMBER },
        logic: { type: SchemaType.NUMBER },
        codeQuality: { type: SchemaType.NUMBER },
        bestPractices: { type: SchemaType.NUMBER },
        edgeCaseHandling: { type: SchemaType.NUMBER },
      },
      required: ["correctness", "logic", "codeQuality", "bestPractices", "edgeCaseHandling"],
    },
    whatYouDid: { type: SchemaType.STRING },
    problem: { type: SchemaType.STRING, nullable: true },
    whyItMatters: { type: SchemaType.STRING, nullable: true },
    hint: { type: SchemaType.STRING, nullable: true },
    nextStep: { type: SchemaType.STRING },
    detectedMisconception: { type: SchemaType.STRING, nullable: true },
    detectedMisconceptionKey: { type: SchemaType.STRING, nullable: true },
    mentorFollowUp: { type: SchemaType.STRING, nullable: true },
  },
  required: [
    "result",
    "scores",
    "whatYouDid",
    "problem",
    "whyItMatters",
    "hint",
    "nextStep",
    "detectedMisconception",
    "detectedMisconceptionKey",
    "mentorFollowUp",
  ],
};

/** Reaction to a learner's reply to `mentorFollowUp` — a short, ungraded continuation of that one exchange. */
export const mentorFollowUpReactionGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    reaction: { type: SchemaType.STRING },
    resolved: { type: SchemaType.BOOLEAN },
  },
  required: ["reaction", "resolved"],
};

export const hintGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    level: { type: SchemaType.STRING, enum: ["direction", "specific_problem", "strong_hint"] },
    text: { type: SchemaType.STRING },
  },
  required: ["level", "text"],
};

export const conceptGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    topic: { type: SchemaType.STRING },
    subtopic: { type: SchemaType.STRING },
    explanation: { type: SchemaType.STRING },
    keyPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    example: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        code: { type: SchemaType.STRING },
        explanation: { type: SchemaType.STRING },
      },
      required: ["code", "explanation"],
    },
  },
  required: ["topic", "subtopic", "explanation", "keyPoints", "example"],
};

/**
 * Gemini's schema language has no recursion ($ref/self-reference), so a
 * truly-recursive tree can't be constrained the way the other schemas in
 * this file are. But the product spec itself caps the learning-path tree
 * at "max depth 3" — so rather than leaving this one completely
 * unconstrained (which is what caused it to invent its own top-level key
 * names, e.g. `path` instead of `topics`, and drop `children` at deeper
 * levels), we just hand-write those 3 levels explicitly. A node one level
 * past this cap would need `children: []`, which Zod's `looseNullable`-
 * style default in lib/schemas.ts now tolerates even if omitted.
 */
function topicNodeSchema(childItems: Schema): Schema {
  return {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING },
      title: { type: SchemaType.STRING },
      summary: { type: SchemaType.STRING },
      prerequisiteIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      children: { type: SchemaType.ARRAY, items: childItems },
    },
    required: ["id", "title", "summary", "prerequisiteIds", "children"],
  };
}

// Depth 3 (deepest allowed): still shaped like a topic node, but its own
// `children` items are left as an empty-schema placeholder — there is
// nothing valid to put there, so Gemini reliably returns `[]`.
const leafPlaceholder: Schema = { type: SchemaType.OBJECT, properties: {} };
const depth3 = topicNodeSchema(leafPlaceholder);
const depth2 = topicNodeSchema(depth3);
const depth1 = topicNodeSchema(depth2);

export const learningPathGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    rationale: { type: SchemaType.STRING },
    topics: { type: SchemaType.ARRAY, items: depth1 },
  },
  required: ["title", "rationale", "topics"],
};

// ---------------------------------------------------------------------------
// Projects (spec section 14)
// ---------------------------------------------------------------------------

export const projectPlanGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    files: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          filename: { type: SchemaType.STRING },
          language: { type: SchemaType.STRING, enum: PROGRAMMING_LANGUAGES },
        },
        required: ["filename", "language"],
      },
    },
    tasks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          taskCode: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          requirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["taskCode", "title", "requirements"],
      },
    },
  },
  required: ["title", "description", "files", "tasks"],
};

export const projectIdeasGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    ideas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
        required: ["topic", "title", "description"],
      },
    },
  },
  required: ["ideas"],
};

export const translatedLearningPathGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    rationale: { type: SchemaType.STRING },
    knowledgeProfileSummary: { type: SchemaType.STRING, nullable: true },
    topics: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          externalId: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          summary: { type: SchemaType.STRING },
        },
        required: ["externalId", "title", "summary"],
      },
    },
  },
  required: ["title", "rationale", "knowledgeProfileSummary", "topics"],
};

export const translatedProjectGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    tasks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          taskCode: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          requirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["taskCode", "title", "requirements"],
      },
    },
  },
  required: ["title", "description", "tasks"],
};

export const codeReviewGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    verdict: { type: SchemaType.STRING, enum: ["approved", "changes_requested"] },
    summary: { type: SchemaType.STRING },
    comments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          severity: { type: SchemaType.STRING, enum: ["blocking", "suggestion", "nit"] },
          comment: { type: SchemaType.STRING },
        },
        required: ["severity", "comment"],
      },
    },
  },
  required: ["verdict", "summary", "comments"],
};

export const translatedExerciseBatchGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    exercises: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          subtopic: { type: SchemaType.STRING },
          prompt: { type: SchemaType.STRING },
          choices: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        },
        required: ["id", "title", "subtopic", "prompt", "choices"],
      },
    },
  },
  required: ["exercises"],
};

export const translatedMistakeBatchGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    mistakes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
        required: ["id", "description"],
      },
    },
  },
  required: ["mistakes"],
};
