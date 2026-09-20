import { describe, expect, it } from "vitest";
import { buildPreviewDoc } from "@/lib/preview-doc";

describe("buildPreviewDoc", () => {
  it("previews HTML as itself", () => {
    expect(buildPreviewDoc("html", "<h1>Hi</h1>", null)).toBe("<h1>Hi</h1>");
  });

  it("applies CSS to the exercise's own markup", () => {
    expect(buildPreviewDoc("css", "h1 { color: red; }", "<h1>Hi</h1>")).toBe(
      "<style>h1 { color: red; }</style>\n<h1>Hi</h1>"
    );
  });

  it("has nothing to show for CSS without markup, or for languages that don't render", () => {
    expect(buildPreviewDoc("css", "h1 {}", null)).toBeNull();
    expect(buildPreviewDoc("css", "h1 {}", "")).toBeNull();
    for (const language of ["javascript", "typescript", "python", "sql"] as const) {
      expect(buildPreviewDoc(language, "x", "<p>m</p>")).toBeNull();
    }
  });
});
