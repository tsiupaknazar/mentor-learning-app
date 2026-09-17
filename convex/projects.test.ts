import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { seedUser } from "./test-helpers";
import type { Id } from "./_generated/dataModel";

function projectArgs(overrides: Record<string, unknown> = {}) {
  return {
    topic: "JavaScript",
    level: "junior" as const,
    title: "Kanban board",
    description: "A drag-and-drop kanban board.",
    files: [{ filename: "index.html", language: "html" as const }],
    tasks: [
      { taskCode: "FE-101", title: "HTML structure", requirements: ["has a header", "has three columns"] },
      { taskCode: "FE-102", title: "Styling", requirements: ["columns are equal width"] },
    ],
    ...overrides,
  };
}

async function createProjectWithTasks(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  const projectId = await t.mutation(api.projects.createProject, { userId, ...projectArgs() });
  const detail = await t.query(api.projects.getProjectDetail, { projectId });
  return { projectId, tasks: detail!.tasks };
}

describe("createProject", () => {
  it("creates the project with empty file content and todo tasks in order", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const { projectId, tasks } = await createProjectWithTasks(t, userId);

    const detail = await t.query(api.projects.getProjectDetail, { projectId });
    expect(detail?.project.files?.[0]?.content).toBe("");
    expect(tasks.map((tk) => tk.taskCode)).toEqual(["FE-101", "FE-102"]);
    expect(tasks.every((tk) => tk.status === "todo")).toBe(true);
  });
});

describe("listProjects", () => {
  it("reports task/done counts per project", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await createProjectWithTasks(t, userId);

    const projects = await t.query(api.projects.listProjects, { userId });
    expect(projects[0]!.taskCount).toBe(2);
    expect(projects[0]!.doneCount).toBe(0);
  });
});

describe("getTaskDetail starting files", () => {
  it("falls back to the project's current file state when no submission exists yet", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { tasks } = await createProjectWithTasks(t, userId);

    const detail = await t.query(api.projects.getTaskDetail, { taskId: tasks[0]!._id });
    expect(detail?.startingFiles).toEqual([{ filename: "index.html", content: "", language: "html" }]);
  });

  it("reopens an existing submission's files instead of the project's base state", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { tasks } = await createProjectWithTasks(t, userId);

    await t.mutation(api.projects.recordSubmissionAndReview, {
      userId,
      projectTaskId: tasks[0]!._id,
      files: [{ filename: "index.html", content: "<h1>Draft</h1>" }],
      verdict: "changes_requested",
      summary: "Needs work",
      comments: [{ severity: "blocking", comment: "missing columns" }],
    });

    const detail = await t.query(api.projects.getTaskDetail, { taskId: tasks[0]!._id });
    expect(detail?.startingFiles).toEqual([
      { filename: "index.html", content: "<h1>Draft</h1>", language: "html" },
    ]);
  });
});

describe("recordSubmissionAndReview", () => {
  it("marks the task changes_requested on a changes_requested verdict, without advancing project files", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { projectId, tasks } = await createProjectWithTasks(t, userId);

    await t.mutation(api.projects.recordSubmissionAndReview, {
      userId,
      projectTaskId: tasks[0]!._id,
      files: [{ filename: "index.html", content: "<h1>Draft</h1>" }],
      verdict: "changes_requested",
      summary: "Needs work",
      comments: [],
    });

    const detail = await t.query(api.projects.getProjectDetail, { projectId });
    expect(detail?.tasks.find((tk) => tk.taskCode === "FE-101")?.status).toBe("changes_requested");
    expect(detail?.project.files?.[0]?.content).toBe(""); // unchanged
    expect(detail?.project.status).toBe("in_progress");
  });

  it("marks the task done and advances project files on approval, awarding XP", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { tasks } = await createProjectWithTasks(t, userId);

    await t.mutation(api.projects.recordSubmissionAndReview, {
      userId,
      projectTaskId: tasks[0]!._id,
      files: [{ filename: "index.html", content: "<h1>Done</h1>" }],
      verdict: "approved",
      summary: "Looks good",
      comments: [],
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.totalXp).toBe(150);
  });

  it("marks the project completed and awards projectShipped only once every task is done", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const { projectId, tasks } = await createProjectWithTasks(t, userId);

    await t.mutation(api.projects.recordSubmissionAndReview, {
      userId,
      projectTaskId: tasks[0]!._id,
      files: [{ filename: "index.html", content: "<h1>Done 1</h1>" }],
      verdict: "approved",
      summary: "ok",
      comments: [],
    });

    let achievements = await t.query(api.achievements.listAchievements, { userId });
    expect(achievements.map((a) => a.key)).not.toContain("project_shipped");
    let detail = await t.query(api.projects.getProjectDetail, { projectId });
    expect(detail?.project.status).toBe("in_progress");

    await t.mutation(api.projects.recordSubmissionAndReview, {
      userId,
      projectTaskId: tasks[1]!._id,
      files: [{ filename: "index.html", content: "<h1>Done 1</h1><style>x</style>" }],
      verdict: "approved",
      summary: "ok",
      comments: [],
    });

    detail = await t.query(api.projects.getProjectDetail, { projectId });
    expect(detail?.project.status).toBe("completed");
    achievements = await t.query(api.achievements.listAchievements, { userId });
    expect(achievements.map((a) => a.key)).toContain("project_shipped");
  });
});
