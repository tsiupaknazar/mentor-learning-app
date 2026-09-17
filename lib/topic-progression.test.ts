import { describe, expect, it } from "vitest";
import { suggestNextTopics } from "@/lib/topic-progression";

describe("suggestNextTopics", () => {
  it("returns [] for null/undefined/empty input", () => {
    expect(suggestNextTopics(null)).toEqual([]);
    expect(suggestNextTopics(undefined)).toEqual([]);
    expect(suggestNextTopics("")).toEqual([]);
  });

  it("returns [] when nothing in the progression map matches", () => {
    expect(suggestNextTopics("Underwater Basket Weaving")).toEqual([]);
  });

  it("suggests topics for known tracks, case-insensitively", () => {
    expect(suggestNextTopics("javascript fundamentals")).toEqual(["TypeScript", "React", "Node.js"]);
    expect(suggestNextTopics("Intro to HTML")).toEqual([
      "JavaScript",
      "Responsive Design",
      "Tailwind CSS",
    ]);
    expect(suggestNextTopics("React Hooks")).toEqual([
      "TypeScript",
      "Next.js",
      "Testing (Jest & RTL)",
    ]);
    expect(suggestNextTopics("SQL for beginners")).toEqual([
      "Python",
      "Database Design",
      "Data Analysis",
    ]);
  });
});
