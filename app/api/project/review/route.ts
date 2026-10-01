import { NextResponse } from "next/server";
import { z } from "zod";

import { generateStructured } from "@/lib/gemini";
import { reviewSchema } from "@/lib/schemas";
import { codeReviewGeminiSchema } from "@/lib/gemini-schemas";
import { buildCodeReviewPrompt } from "@/lib/prompts";
import { requireCurrentUser } from "@/lib/current-user";
import { convexMutation, convexQuery } from "@/lib/convex-server";
import { getLearnerContext } from "@/lib/learner-context";
import { handleRouteError } from "@/lib/route-utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const requestSchema = z.object({
  projectTaskId: z.string().min(1),
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(60),
        content: z.string().max(20000),
      })
    )
    .min(1)
    .max(10),
});

/**
 * AI code review on a submitted task (spec section 14: "The user submits
 * their implementation. AI performs a code review."). Submissions are
 * multi-file (e.g. index.html + styles.css + script.js for a UI project),
 * not a single code string — see convex/projects.ts for how the project's
 * shared file state carries forward between tasks. Fetches the task's
 * requirements and, if this is a resubmission, the previous review server-
 * side, so the model can check whether earlier blocking comments were
 * actually addressed rather than re-reviewing from a blank slate.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());
    const projectTaskId = body.projectTaskId as Id<"projectTasks">;

    const detail = await convexQuery(api.projects.getTaskDetail, { taskId: projectTaskId });
    if (!detail || detail.task.userId !== user._id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const mostRecent = detail.submissionsWithReviews[0];
    const previousReview =
      mostRecent?.review && mostRecent.review.verdict === "changes_requested"
        ? { summary: mostRecent.review.summary, comments: mostRecent.review.comments }
        : null;

    const learnerContext = await getLearnerContext(user._id).catch(() => ({
      level: user.level,
      learningGoal: user.learningGoal,
      learningStyle: user.learningStyle,
      dailyTime: user.dailyTime,
      specialty: user.specialty ?? "general",
      locale: user.locale ?? "en",
      currentTopics: [],
      weakTopics: [],
      strongTopics: [],
      recurringMistakes: [],
      recentPerformance: 0,
      pathSubject: null,
    }));

    const { system, prompt } = buildCodeReviewPrompt(
      learnerContext,
      { taskCode: detail.task.taskCode, title: detail.task.title, requirements: detail.task.requirements },
      body.files,
      previousReview
    );

    const review = await generateStructured({
      schema: reviewSchema,
      responseSchema: codeReviewGeminiSchema,
      system,
      prompt,
      tier: "reasoning",
    });

    const { taskStatus } = await convexMutation(api.projects.recordSubmissionAndReview, {
      userId: user._id,
      projectTaskId,
      files: body.files,
      verdict: review.verdict,
      summary: review.summary,
      comments: review.comments,
    });

    return NextResponse.json({ review, taskStatus });
  } catch (err) {
    return handleRouteError(err);
  }
}
