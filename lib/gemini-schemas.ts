import { Type, type Schema } from "@google/genai";

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
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ["knowledge", "code_reading", "debugging", "implementation", "explanation"],
          },
          subtopic: { type: Type.STRING },
          prompt: { type: Type.STRING },
          codeSnippet: { type: Type.STRING, nullable: true },
          choices: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
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
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    subtopics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subtopic: { type: Type.STRING },
          band: { type: Type.STRING, enum: ["weak", "medium", "strong"] },
          rationale: { type: Type.STRING },
        },
        required: ["subtopic", "band", "rationale"],
      },
    },
    suggestedLevel: {
      type: Type.STRING,
      enum: ["beginner", "junior", "intermediate", "advanced"],
    },
    summary: { type: Type.STRING },
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
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    topic: { type: Type.STRING },
    subtopic: { type: Type.STRING },
    type: { type: Type.STRING, enum: EXERCISE_TYPES },
    difficulty: { type: Type.STRING, enum: EXERCISE_DIFFICULTIES },
    language: { type: Type.STRING, enum: PROGRAMMING_LANGUAGES },
    title: { type: Type.STRING },
    prompt: { type: Type.STRING },
    starterCode: { type: Type.STRING, nullable: true },
    choices: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
    testCases: {
      type: Type.ARRAY,
      nullable: true,
      items: {
        type: Type.OBJECT,
        properties: {
          input: { type: Type.STRING },
          expectedOutput: { type: Type.STRING },
          description: { type: Type.STRING, nullable: true },
        },
        required: ["input", "expectedOutput", "description"],
      },
    },
    referenceSolution: { type: Type.STRING },
    previewMarkup: { type: Type.STRING, nullable: true },
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
    "previewMarkup",
  ],
};

/** A batch of exercises for the Practice board — same shape as a single exercise, just wrapped in an array. */
export const practiceProblemSetGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    problems: { type: Type.ARRAY, items: exerciseGeminiSchema },
  },
  required: ["problems"],
};

export const evaluationGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    result: { type: Type.STRING, enum: ["correct", "partially_correct", "incorrect"] },
    scores: {
      type: Type.OBJECT,
      properties: {
        correctness: { type: Type.NUMBER },
        logic: { type: Type.NUMBER },
        codeQuality: { type: Type.NUMBER },
        bestPractices: { type: Type.NUMBER },
        edgeCaseHandling: { type: Type.NUMBER },
      },
      required: ["correctness", "logic", "codeQuality", "bestPractices", "edgeCaseHandling"],
    },
    whatYouDid: { type: Type.STRING },
    problem: { type: Type.STRING, nullable: true },
    whyItMatters: { type: Type.STRING, nullable: true },
    hint: { type: Type.STRING, nullable: true },
    nextStep: { type: Type.STRING },
    detectedMisconception: { type: Type.STRING, nullable: true },
    detectedMisconceptionKey: { type: Type.STRING, nullable: true },
    relatedLessonSection: { type: Type.STRING, nullable: true },
    mentorFollowUp: { type: Type.STRING, nullable: true },
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
    "relatedLessonSection",
    "mentorFollowUp",
  ],
};

/** Reaction to a learner's reply to `mentorFollowUp` — a short, ungraded continuation of that one exchange. */
export const mentorFollowUpReactionGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reaction: { type: Type.STRING },
    resolved: { type: Type.BOOLEAN },
  },
  required: ["reaction", "resolved"],
};

export const hintGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    level: { type: Type.STRING, enum: ["direction", "specific_problem", "strong_hint"] },
    text: { type: Type.STRING },
  },
  required: ["level", "text"],
};

const conceptExampleGeminiSchema: Schema = {
  type: Type.OBJECT,
  nullable: true,
  properties: {
    code: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ["code", "explanation"],
};

export const conceptGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    subtopic: { type: Type.STRING },
    explanation: { type: Type.STRING },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    example: conceptExampleGeminiSchema,
    language: { type: Type.STRING, enum: PROGRAMMING_LANGUAGES, nullable: true },
    // A beginner's guided lesson; an empty array for every other level.
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body: { type: Type.STRING },
          example: conceptExampleGeminiSchema,
          check: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              question: { type: Type.STRING },
              choices: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
            },
            required: ["question", "choices", "correctIndex", "explanation"],
          },
        },
        required: ["heading", "body", "example", "check"],
      },
    },
  },
  required: ["topic", "subtopic", "explanation", "keyPoints", "example", "language", "sections"],
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
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      summary: { type: Type.STRING },
      prerequisiteIds: { type: Type.ARRAY, items: { type: Type.STRING } },
      children: { type: Type.ARRAY, items: childItems },
    },
    required: ["id", "title", "summary", "prerequisiteIds", "children"],
  };
}

// Depth 3 (deepest allowed): still shaped like a topic node, but its own
// `children` items are left as an empty-schema placeholder — there is
// nothing valid to put there, so Gemini reliably returns `[]`.
const leafPlaceholder: Schema = { type: Type.OBJECT, properties: {} };
const depth3 = topicNodeSchema(leafPlaceholder);
const depth2 = topicNodeSchema(depth3);
const depth1 = topicNodeSchema(depth2);

export const learningPathGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    rationale: { type: Type.STRING },
    topics: { type: Type.ARRAY, items: depth1 },
  },
  required: ["title", "rationale", "topics"],
};

// ---------------------------------------------------------------------------
// Projects (spec section 14)
// ---------------------------------------------------------------------------

export const projectPlanGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    files: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          filename: { type: Type.STRING },
          language: { type: Type.STRING, enum: PROGRAMMING_LANGUAGES },
        },
        required: ["filename", "language"],
      },
    },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          taskCode: { type: Type.STRING },
          title: { type: Type.STRING },
          requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["taskCode", "title", "requirements"],
      },
    },
  },
  required: ["title", "description", "files", "tasks"],
};

export const projectIdeasGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ideas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["topic", "title", "description"],
      },
    },
  },
  required: ["ideas"],
};

export const translatedLearningPathGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    rationale: { type: Type.STRING },
    knowledgeProfileSummary: { type: Type.STRING, nullable: true },
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          externalId: { type: Type.STRING },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["externalId", "title", "summary"],
      },
    },
  },
  required: ["title", "rationale", "knowledgeProfileSummary", "topics"],
};

export const translatedProjectGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          taskCode: { type: Type.STRING },
          title: { type: Type.STRING },
          requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["taskCode", "title", "requirements"],
      },
    },
  },
  required: ["title", "description", "tasks"],
};

export const codeReviewGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    verdict: { type: Type.STRING, enum: ["approved", "changes_requested"] },
    summary: { type: Type.STRING },
    comments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ["blocking", "suggestion", "nit"] },
          comment: { type: Type.STRING },
        },
        required: ["severity", "comment"],
      },
    },
  },
  required: ["verdict", "summary", "comments"],
};

export const translatedExerciseBatchGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          subtopic: { type: Type.STRING },
          prompt: { type: Type.STRING },
          choices: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        },
        required: ["id", "title", "subtopic", "prompt", "choices"],
      },
    },
  },
  required: ["exercises"],
};

export const translatedMistakeBatchGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    mistakes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["id", "description"],
      },
    },
  },
  required: ["mistakes"],
};
