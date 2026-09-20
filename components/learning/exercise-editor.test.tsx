import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExerciseEditor } from "./exercise-editor";

const { runJsTestsMock } = vi.hoisted(() => ({ runJsTestsMock: vi.fn() }));
vi.mock("@/lib/js-tests", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  runJsTests: runJsTestsMock,
}));

// CodeMirror is out of scope here: the editor is a plain controlled textarea.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="code" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/lib/format-code", () => ({
  isFormattable: () => false,
  formatCode: vi.fn(async (code: string) => code),
}));

describe("ExerciseEditor", () => {
  it("shows an HTML exercise as the page it makes, updating as the learner types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseEditor starterCode="<h1>Hi</h1>" language="html" onChange={onChange} />);

    expect(screen.getByTitle("Preview")).toHaveAttribute("srcdoc", "<h1>Hi</h1>");
    expect(screen.getByTitle("Preview")).toHaveAttribute("sandbox", "allow-scripts");

    await user.clear(screen.getByLabelText("code"));
    await user.type(screen.getByLabelText("code"), "<p>Mine</p>");

    expect(screen.getByTitle("Preview")).toHaveAttribute("srcdoc", "<p>Mine</p>");
    expect(onChange).toHaveBeenLastCalledWith("<p>Mine</p>");
  });

  it("previews CSS against the exercise's own markup", () => {
    render(
      <ExerciseEditor
        starterCode="h1 { color: red; }"
        language="css"
        previewMarkup="<h1>Title</h1>"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTitle("Preview")).toHaveAttribute("srcdoc", "<style>h1 { color: red; }</style>\n<h1>Title</h1>");
  });

  it("restores a returning learner's attempt in the preview, not the starter", () => {
    render(<ExerciseEditor starterCode="<h1>Starter</h1>" initialCode="<h1>Mine</h1>" language="html" onChange={vi.fn()} />);
    expect(screen.getByTitle("Preview")).toHaveAttribute("srcdoc", "<h1>Mine</h1>");
  });

  it("has no preview where there is nothing to render", () => {
    const { rerender } = render(<ExerciseEditor starterCode="x" language="javascript" onChange={vi.fn()} />);
    expect(screen.queryByTitle("Preview")).not.toBeInTheDocument();

    rerender(<ExerciseEditor starterCode="a {}" language="css" onChange={vi.fn()} />); // CSS with no markup
    expect(screen.queryByTitle("Preview")).not.toBeInTheDocument();
  });
});

describe("ExerciseEditor: running the exercise's tests", () => {
  const TESTS = [
    { input: "sum(2, 3)", expectedOutput: "5" },
    { input: "sum(0, 0)", expectedOutput: "0" },
  ];
  const props = { starterCode: "function sum(a, b) {}", language: "javascript" as const, testCases: TESTS, onChange: vi.fn() };

  it("runs the learner's current code against the tests and reports each case", async () => {
    runJsTestsMock.mockResolvedValue([
      { input: "sum(2, 3)", expected: "5", actual: "undefined", passed: false, error: null },
      { input: "sum(0, 0)", expected: "0", actual: "0", passed: true, error: null },
    ]);
    const user = userEvent.setup();
    render(<ExerciseEditor {...props} />);

    await user.click(screen.getByRole("button", { name: "Run tests" }));

    expect(await screen.findByRole("status")).toHaveTextContent("1 of 2 tests pass");
    expect(runJsTestsMock).toHaveBeenCalledWith("function sum(a, b) {}", TESTS);
    expect(screen.getByText("sum(2, 3)")).toBeInTheDocument();
    expect(screen.getByText(/expected 5 · got undefined/)).toBeInTheDocument();
  });

  it("shows why a case failed when the code threw", async () => {
    runJsTestsMock.mockResolvedValue([{ input: "sum(2, 3)", expected: "5", actual: null, passed: false, error: "sum is not defined" }]);
    render(<ExerciseEditor {...props} testCases={[TESTS[0]!]} />);

    await userEvent.click(screen.getByRole("button", { name: "Run tests" }));

    expect(await screen.findByText(/expected 5 · sum is not defined/)).toBeInTheDocument();
  });

  it("drops results as soon as the code changes, since they describe code no longer there", async () => {
    runJsTestsMock.mockResolvedValue([{ input: "sum(2, 3)", expected: "5", actual: "5", passed: true, error: null }]);
    const user = userEvent.setup();
    render(<ExerciseEditor {...props} testCases={[TESTS[0]!]} />);
    await user.click(screen.getByRole("button", { name: "Run tests" }));
    await screen.findByRole("status");

    await user.type(screen.getByLabelText("code"), " ");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says so where tests can't run", async () => {
    runJsTestsMock.mockResolvedValue(null);
    render(<ExerciseEditor {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Run tests" }));

    expect(await screen.findByText("Tests can't run in this browser.")).toBeInTheDocument();
  });

  it("offers no button when the tests aren't in a runnable format, or the language isn't JavaScript", () => {
    const { rerender } = render(<ExerciseEditor {...props} testCases={[{ input: "2, 3", expectedOutput: "5" }]} />);
    expect(screen.queryByRole("button", { name: "Run tests" })).not.toBeInTheDocument();

    rerender(<ExerciseEditor {...props} language="python" />);
    expect(screen.queryByRole("button", { name: "Run tests" })).not.toBeInTheDocument();

    rerender(<ExerciseEditor {...props} testCases={null} />);
    expect(screen.queryByRole("button", { name: "Run tests" })).not.toBeInTheDocument();
  });
});
