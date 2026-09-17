import { describe, expect, it } from "vitest";
import type { Schema } from "@google/genai";
import {
  diagnosticSetGeminiSchema,
  knowledgeProfileGeminiSchema,
  exerciseGeminiSchema,
  practiceProblemSetGeminiSchema,
  evaluationGeminiSchema,
  mentorFollowUpReactionGeminiSchema,
  hintGeminiSchema,
  conceptGeminiSchema,
  learningPathGeminiSchema,
  projectPlanGeminiSchema,
  projectIdeasGeminiSchema,
  translatedLearningPathGeminiSchema,
  translatedProjectGeminiSchema,
  codeReviewGeminiSchema,
  translatedExerciseBatchGeminiSchema,
  translatedMistakeBatchGeminiSchema,
} from "@/lib/gemini-schemas";

const ALL_SCHEMAS: Record<string, Schema> = {
  diagnosticSetGeminiSchema,
  knowledgeProfileGeminiSchema,
  exerciseGeminiSchema,
  practiceProblemSetGeminiSchema,
  evaluationGeminiSchema,
  mentorFollowUpReactionGeminiSchema,
  hintGeminiSchema,
  conceptGeminiSchema,
  learningPathGeminiSchema,
  projectPlanGeminiSchema,
  projectIdeasGeminiSchema,
  translatedLearningPathGeminiSchema,
  translatedProjectGeminiSchema,
  codeReviewGeminiSchema,
  translatedExerciseBatchGeminiSchema,
  translatedMistakeBatchGeminiSchema,
};

/**
 * The whole point of hand-writing these schemas (per the file's own header
 * comment) is forcing every field to appear in `required` so Gemini can't
 * just omit an optional-looking key. Recursively verifies that invariant:
 * everywhere there's a `properties` object, every one of its keys is listed
 * in the sibling `required` array.
 */
function assertAllPropertiesRequired(schema: Schema, path: string) {
  if (schema.properties) {
    const propertyKeys = Object.keys(schema.properties);
    const required = schema.required ?? [];
    for (const key of propertyKeys) {
      expect(required, `${path}: "${key}" must be in "required"`).toContain(key);
    }
    for (const key of propertyKeys) {
      const child = schema.properties[key];
      if (child) assertAllPropertiesRequired(child, `${path}.${key}`);
    }
  }
  if (schema.items) {
    assertAllPropertiesRequired(schema.items, `${path}[]`);
  }
}

describe("every hand-written Gemini schema", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    it(`${name}: every property key is listed in its object's required array`, () => {
      assertAllPropertiesRequired(schema, name);
    });
  }
});

describe("learningPathGeminiSchema's depth-3 tree unrolling", () => {
  it("unrolls to exactly 3 levels of topic nodes, with a childless leaf placeholder at the bottom", () => {
    const depth1 = learningPathGeminiSchema.properties?.topics?.items;
    expect(depth1?.properties?.children).toBeDefined();

    const depth2 = depth1?.properties?.children?.items;
    expect(depth2?.properties?.children).toBeDefined();

    const depth3 = depth2?.properties?.children?.items;
    expect(depth3?.properties?.children).toBeDefined();

    const leafPlaceholder = depth3?.properties?.children?.items;
    expect(leafPlaceholder?.properties).toEqual({});
  });
});
