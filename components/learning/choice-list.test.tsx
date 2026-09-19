import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChoiceList } from "./choice-list";

const CHOICES = ["let", "const", "var"];

function Harness({ initial = "", onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <ChoiceList
      label="Which keyword?"
      choices={CHOICES}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      secondary={{ value: "__unsure__", label: "I don't know" }}
    />
  );
}

describe("ChoiceList", () => {
  it("is a labelled radio group with one radio per option, including the secondary one", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Which keyword?" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["let", "const", "var", "I don't know"]);
  });

  it("reflects the selection with aria-checked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);

    await user.click(screen.getByRole("radio", { name: "const" }));
    expect(screen.getByRole("radio", { name: "const" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "let" })).not.toBeChecked();
  });

  it("makes the group a single tab stop: the selected radio, else the first", () => {
    const { unmount } = render(<Harness />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
    unmount();

    render(<Harness initial="var" />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it("moves the selection and focus with the arrow keys, wrapping around", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="let" onChange={onChange} />);

    screen.getByRole("radio", { name: "let" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("const");
    expect(screen.getByRole("radio", { name: "const" })).toHaveFocus();

    await user.keyboard("{ArrowUp}{ArrowUp}"); // const -> let -> wraps to "I don't know"
    expect(onChange).toHaveBeenLastCalledWith("__unsure__");
    expect(screen.getByRole("radio", { name: "I don't know" })).toHaveFocus();

    await user.keyboard("{ArrowDown}"); // wraps to the first
    expect(onChange).toHaveBeenLastCalledWith("let");
  });

  it("supports Home and End", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="const" onChange={onChange} />);

    screen.getByRole("radio", { name: "const" }).focus();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("__unsure__");
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("let");
  });
});
