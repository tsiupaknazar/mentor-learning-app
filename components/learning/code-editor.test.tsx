import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeEditor } from "./code-editor";

// CodeMirror is out of scope for component tests (it needs real layout
// APIs jsdom doesn't have) - stubbed as a plain controlled textarea so the
// tests exercise CodeEditor's own state handling (initial value, reset,
// auto-format) rather than the editor widget itself.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="code" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

// Prettier is a large dynamic import - replaced with a deterministic
// "formatter" so the auto-format-on-mount path can be asserted on.
vi.mock("@/lib/format-code", () => ({
  isFormattable: () => true,
  formatCode: vi.fn(async (code: string) => `FORMATTED(${code})`),
}));

describe("CodeEditor", () => {
  it("auto-formats the starter code on mount and reports it through onChange", async () => {
    const onChange = vi.fn();
    render(<CodeEditor starterCode="let a=1" onChange={onChange} />);

    await waitFor(() => expect(screen.getByLabelText("code")).toHaveValue("FORMATTED(let a=1)"));
    expect(onChange).toHaveBeenCalledWith("FORMATTED(let a=1)");
  });

  it("shows initialCode instead of the starter code, and does not format over it", async () => {
    const onChange = vi.fn();
    render(<CodeEditor starterCode="let a=1" initialCode="let a = 42;" onChange={onChange} />);

    expect(screen.getByLabelText("code")).toHaveValue("let a = 42;");

    // Give the mount-time format effect a chance to (wrongly) overwrite it.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByLabelText("code")).toHaveValue("let a = 42;");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Reset goes back to the formatted starter code, not to the restored attempt", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CodeEditor starterCode="let a=1" initialCode="let a = 42;" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => expect(screen.getByLabelText("code")).toHaveValue("FORMATTED(let a=1)"));
    expect(onChange).toHaveBeenLastCalledWith("FORMATTED(let a=1)");
  });
});
