import { describe, expect, it } from "vitest";
import { isFormattable, formatCode } from "@/lib/format-code";

describe("isFormattable", () => {
  it("is true for javascript, typescript, html, and css", () => {
    expect(isFormattable("javascript")).toBe(true);
    expect(isFormattable("typescript")).toBe(true);
    expect(isFormattable("html")).toBe(true);
    expect(isFormattable("css")).toBe(true);
  });

  it("is false for python and sql", () => {
    expect(isFormattable("python")).toBe(false);
    expect(isFormattable("sql")).toBe(false);
  });
});

describe("formatCode", () => {
  it("reformats unindented, single-line JavaScript", async () => {
    const result = await formatCode("function add(a,b){return a+b}", "javascript");
    expect(result).toContain("\n");
    expect(result.trim()).not.toBe("function add(a,b){return a+b}");
  });

  it("reformats TypeScript", async () => {
    const result = await formatCode("const x:number=1;", "typescript");
    expect(result).toContain("const x: number = 1;");
  });

  it("reformats HTML with inline script/style", async () => {
    const result = await formatCode(
      "<div><script>const x=1;</script><style>body{color:red}</style></div>",
      "html"
    );
    expect(result).toContain("\n");
  });

  it("reformats CSS", async () => {
    const result = await formatCode("body{color:red;margin:0}", "css");
    expect(result).toContain("\n");
  });

  it("passes non-formattable languages through unchanged", async () => {
    const code = "def add(a, b):\n    return a+b";
    expect(await formatCode(code, "python")).toBe(code);
    expect(await formatCode("SELECT * FROM users", "sql")).toBe("SELECT * FROM users");
  });

  it("passes empty/whitespace-only input through unchanged", async () => {
    expect(await formatCode("", "javascript")).toBe("");
    expect(await formatCode("   ", "javascript")).toBe("   ");
  });

  it("falls back to the original string when the code is syntactically incomplete", async () => {
    const broken = "function add(a, b) { return a + b";
    expect(await formatCode(broken, "javascript")).toBe(broken);
  });
});
