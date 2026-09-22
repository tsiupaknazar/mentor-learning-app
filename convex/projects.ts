import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { awardAchievement, ACHIEVEMENT_KEYS } from "./lib/achievements";
import { awardXp } from "./lib/xp";
import { recordDailyActivity } from "./lib/streaks";

// A completed project task is a bigger accomplishment than a single
// exercise (multi-file, multi-step, resubmission-until-right), so it's
// worth more XP than even a clean-first-try exercise (100, see attempts.ts).
const XP_FOR_APPROVED_TASK = 150;

const skillLevel = v.union(
  v.literal("beginner"),
  v.literal("junior"),
  v.literal("intermediate"),
  v.literal("advanced")
);

const programmingLanguage = v.union(
  v.literal("javascript"),
  v.literal("typescript"),
  v.literal("html"),
  v.literal("css"),
  v.literal("python"),
  v.literal("sql"),
  v.literal("java")
);

/** Persists a Gemini-generated project plan (already validated by `projectPlanSchema` in the API route). */
export const createProject = mutation({
  args: {
    userId: v.id("users"),
    topic: v.string(),
    level: skillLevel,
    title: v.string(),
    description: v.string(),
    files: v.array(
      v.object({
        filename: v.string(),
        language: programmingLanguage,
      })
    ),
    tasks: v.array(
      v.object({
        taskCode: v.string(),
        title: v.string(),
        requirements: v.array(v.string()),
      })
    ),
    contentLocale: v.optional(v.union(v.literal("en"), v.literal("uk"))),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      userId: args.userId,
      topic: args.topic,
      title: args.title,
      description: args.description,
      level: args.level,
      // No starter/skeleton code — every file begins empty so the learner
      // writes it from scratch starting with the first task, rather than
      // getting an AI-authored head start that functions as a hint.
      files: args.files.map((f) => ({
        filename: f.filename,
        language: f.language,
        content: "",
      })),
      status: "not_started",
      createdAt: Date.now(),
      contentLocale: args.contentLocale ?? "en",
    });

    for (let i = 0; i < args.tasks.length; i++) {
      const task = args.tasks[i];
      if (!task) continue;
      await ctx.db.insert("projectTasks", {
        projectId,
        userId: args.userId,
        taskCode: task.taskCode,
        title: task.title,
        requirements: task.requirements,
        status: "todo",
        orderIndex: i,
      });
    }

    return projectId;
  },
});

export const listProjects = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("projectTasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const doneCount = tasks.filter((t) => t.status === "done").length;
        return { project, taskCount: tasks.length, doneCount };
      })
    );
  },
});

export const getProjectDetail = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const tasks = await ctx.db
      .query("projectTasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    tasks.sort((a, b) => a.orderIndex - b.orderIndex);
    return { project, tasks };
  },
});

/**
 * Returns the task plus the files the editor should open with:
 * - If this exact task already has a submission (in progress / changes
 *   requested / done), reopen THAT submission's files, so the learner's
 *   own work-in-progress is never discarded.
 * - Otherwise, start from the project's current file state — which is the
 *   codebase as it stood after the most recently APPROVED task, so a new
 *   task builds on real prior work instead of a blank slate every time.
 */
export const getTaskDetail = query({
  args: { taskId: v.id("projectTasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    const project = await ctx.db.get(task.projectId);

    const submissions = await ctx.db
      .query("codeSubmissions")
      .withIndex("by_project_task", (q) => q.eq("projectTaskId", args.taskId))
      .order("desc")
      .collect();

    const submissionsWithReviews = await Promise.all(
      submissions.map(async (submission) => {
        const review = await ctx.db
          .query("reviews")
          .withIndex("by_submission", (q) => q.eq("codeSubmissionId", submission._id))
          .unique();
        return { submission, review };
      })
    );

    const languageByFilename = new Map((project?.files ?? []).map((f) => [f.filename, f.language]));
    const baseFiles =
      submissionsWithReviews[0]?.submission.files ??
      (project?.files ?? []).map((f) => ({ filename: f.filename, content: f.content }));
    const startingFiles = baseFiles.map((f) => ({
      filename: f.filename,
      content: f.content,
      language: languageByFilename.get(f.filename) ?? "javascript",
    }));

    // The first later, not-yet-done task in this project (null when this is
    // the last open one), so finishing a ticket can lead straight into the next.
    const projectTasks = await ctx.db
      .query("projectTasks")
      .withIndex("by_project", (q) => q.eq("projectId", task.projectId))
      .collect();
    const nextTask =
      projectTasks
        .filter((tk) => tk.orderIndex > task.orderIndex && tk.status !== "done")
        .sort((a, b) => a.orderIndex - b.orderIndex)[0] ?? null;

    return {
      task,
      project,
      submissionsWithReviews,
      startingFiles,
      nextTask: nextTask ? { _id: nextTask._id, taskCode: nextTask.taskCode, title: nextTask.title } : null,
    };
  },
});

/**
 * Records a submission + its AI review (already validated by `reviewSchema`
 * in the API route) and updates task/project status deterministically —
 * the verdict decides the state transition, not a separate AI call. On
 * approval, the project's file state advances to what was submitted, so
 * the NEXT task starts from here (spec section 14's tasks build on the
 * same evolving codebase, not isolated snippets).
 */
export const recordSubmissionAndReview = mutation({
  args: {
    userId: v.id("users"),
    projectTaskId: v.id("projectTasks"),
    files: v.array(
      v.object({
        filename: v.string(),
        content: v.string(),
      })
    ),
    verdict: v.union(v.literal("approved"), v.literal("changes_requested")),
    summary: v.string(),
    comments: v.array(
      v.object({
        severity: v.union(v.literal("blocking"), v.literal("suggestion"), v.literal("nit")),
        comment: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.projectTaskId);
    if (!task) throw new Error("Task not found.");

    const submissionId = await ctx.db.insert("codeSubmissions", {
      userId: args.userId,
      projectTaskId: args.projectTaskId,
      files: args.files,
      submittedAt: Date.now(),
    });

    await ctx.db.insert("reviews", {
      codeSubmissionId: submissionId,
      userId: args.userId,
      verdict: args.verdict,
      summary: args.summary,
      comments: args.comments,
      createdAt: Date.now(),
    });

    const newTaskStatus = args.verdict === "approved" ? "done" : "changes_requested";
    await ctx.db.patch(args.projectTaskId, { status: newTaskStatus });

    // --- Gamification: XP + streak (section 26) -----------------------
    // Previously only exercises granted XP/counted toward the daily streak
    // — a day spent entirely on a project looked inactive. Both now fire
    // on every submission (streak) / approval (XP), same as the exercise
    // loop in attempts.ts.
    await recordDailyActivity(ctx, args.userId);
    if (args.verdict === "approved") {
      await awardXp(ctx, args.userId, XP_FOR_APPROVED_TASK);
    }

    const project = await ctx.db.get(task.projectId);
    if (project) {
      // Language isn't part of a submission (the learner doesn't rename/add
      // files), so carry it over from the project's existing file record —
      // falling back to the previous content's language only; new filenames
      // that weren't in the manifest default to matching an existing entry
      // or are dropped from language tracking (content still saved).
      const languageByFilename = new Map((project.files ?? []).map((f) => [f.filename, f.language]));
      const updatedFiles = args.files.map((f) => ({
        filename: f.filename,
        language: languageByFilename.get(f.filename) ?? "javascript",
        content: f.content,
      }));

      const siblingTasks = await ctx.db
        .query("projectTasks")
        .withIndex("by_project", (q) => q.eq("projectId", task.projectId))
        .collect();
      const allDone = siblingTasks.every((t) =>
        t._id === args.projectTaskId ? newTaskStatus === "done" : t.status === "done"
      );
      const nextStatus = allDone ? "completed" : project.status === "not_started" ? "in_progress" : project.status;

      const patch: Record<string, unknown> = {};
      if (nextStatus !== project.status) patch.status = nextStatus;
      // Only advance the project's shared file state on approval — a
      // changes-requested submission stays visible via getTaskDetail's
      // per-task submission lookup, but shouldn't become what OTHER tasks
      // build on top of.
      if (args.verdict === "approved") patch.files = updatedFiles;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(task.projectId, patch);
      }

      if (nextStatus === "completed" && project.status !== "completed") {
        await awardAchievement(ctx, args.userId, ACHIEVEMENT_KEYS.projectShipped);
      }
    }

    return { submissionId, taskStatus: newTaskStatus };
  },
});
