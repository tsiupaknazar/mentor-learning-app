import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Concept } from "@/lib/schemas";
import { ConceptLesson, ConceptPanel } from "./concept-panel";

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));
vi.mock("@/lib/analytics/track", () => ({ track: trackMock }));

// CodeMirror is out of scope here: the editors are plain controlled textareas.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="code" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/lib/format-code", () => ({
  isFormattable: () => false,
  formatCode: vi.fn(async (code: string) => code),
}));
// CodeMirror is out of scope here; the examples' code shows up as plain text.
vi.mock("@/components/learning/read-only-code", () => ({
  ReadOnlyCode: ({ code, language }: { code: string; language?: string }) => (
    <pre data-language={language}>{code}</pre>
  ),
}));

const QUICK: Concept = {
  topic: "HTML",
  subtopic: "Headings",
  explanation: "Headings title a section of a page.",
  keyPoints: ["h1 is the biggest", "Use one h1 per page"],
  example: { code: "<h1>Hi</h1>", explanation: "A top-level heading." },
  language: "html",
};

const LESSON: Concept = {
  ...QUICK,
  example: null,
  sections: [
    {
      heading: "What is a tag?",
      body: "A tag tells the browser what a piece of content is.",
      example: { code: "<p>Hello</p>", explanation: "A paragraph tag." },
      check: {
        question: "Which one is a tag?",
        choices: ["<p>", "p"],
        correctIndex: 0,
        explanation: "Tags are wrapped in angle brackets.",
      },
    },
    { heading: "Common mistakes", body: "Forgetting the closing tag.", example: null, check: null },
  ],
};

describe("ConceptLesson", () => {
  it("shows a quick concept as a single card with just the start button", async () => {
    const onFinish = vi.fn();
    render(<ConceptLesson concept={QUICK} onFinish={onFinish} />);

    expect(screen.getByText("Headings title a section of a page.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Step \d of \d/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Start practicing" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("pages a beginner lesson: intro, each section, then the recap", async () => {
    const user = userEvent.setup();
    render(<ConceptLesson concept={LESSON} onFinish={vi.fn()} />);

    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("Headings title a section of a page.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start practicing" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What is a tag?" })).toBeInTheDocument();
    expect(screen.getByText("<p>Hello</p>")).toHaveAttribute("data-language", "html");
    expect(screen.queryByText("Headings title a section of a page.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByRole("heading", { name: "Common mistakes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key takeaways" })).toBeInTheDocument();
    expect(screen.getByText("Use one h1 per page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
  });

  it("lets the learner go back, and only finishes from the last step", async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<ConceptLesson concept={LESSON} onFinish={onFinish} />);

    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe("ConceptPanel", () => {
  it("stacks a whole lesson on one page for revision", () => {
    render(<ConceptPanel concept={LESSON} />);

    expect(screen.getByText(/Lesson · Headings/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What is a tag?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Common mistakes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key takeaways" })).toBeInTheDocument();
  });

  it("still renders a concept cached before sections existed", () => {
    const { sections: _sections, language: _language, ...legacy } = QUICK;
    render(<ConceptPanel concept={legacy} />);

    expect(screen.getByText(/Quick concept · Headings/)).toBeInTheDocument();
    expect(screen.getByText("<h1>Hi</h1>")).toBeInTheDocument();
  });
});

describe("a lesson step's self-check", () => {
  it("gives instant, ungraded feedback and never blocks Next", async () => {
    const user = userEvent.setup();
    render(<ConceptLesson concept={LESSON} onFinish={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(screen.getByText("Quick check")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "p" }));
    expect(screen.getByRole("status")).toHaveTextContent("Not quite. Tags are wrapped in angle brackets.");

    await user.click(screen.getByRole("radio", { name: "<p>" }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct.");
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();
  });

  it("starts unanswered on each step, and is absent where a section has none", async () => {
    const user = userEvent.setup();
    render(<ConceptLesson concept={LESSON} onFinish={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("radio", { name: "<p>" }));

    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.queryByText("Quick check")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument(); // remounted, unanswered
  });

  it("is left out of the stacked revision view", () => {
    render(<ConceptPanel concept={LESSON} />);
    expect(screen.queryByText("Quick check")).not.toBeInTheDocument();
  });
});

describe("trying an example", () => {
  it("opens an HTML example as an editor with a live preview", async () => {
    const user = userEvent.setup();
    render(<ConceptPanel concept={{ ...LESSON, sections: [{ ...LESSON.sections![0]!, check: null }] }} />);

    expect(screen.queryByTitle("Live preview")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try it yourself" }));

    expect(screen.getByLabelText("code")).toHaveValue("<p>Hello</p>");
    expect(screen.getByTitle("Live preview")).toHaveAttribute("srcdoc", "<p>Hello</p>");

    await user.clear(screen.getByLabelText("code"));
    await user.type(screen.getByLabelText("code"), "<h1>Mine</h1>");
    expect(screen.getByTitle("Live preview")).toHaveAttribute("srcdoc", "<h1>Mine</h1>");
    // Sandboxed: the preview can run scripts but never touches the app.
    expect(screen.getByTitle("Live preview")).toHaveAttribute("sandbox", "allow-scripts");
  });

  it("opens a JavaScript example in the runnable editor", async () => {
    const user = userEvent.setup();
    const js: Concept = { ...QUICK, language: "javascript", example: { code: "console.log(1);", explanation: "Logs one." } };
    render(<ConceptPanel concept={js} />);

    await user.click(screen.getByRole("button", { name: "Try it yourself" }));

    expect(screen.getByRole("button", { name: /Run/ })).toBeInTheDocument();
  });

  it("offers no Try it for a language that can't be run here", () => {
    for (const language of ["css", "python", "sql"] as const) {
      const { unmount } = render(<ConceptPanel concept={{ ...QUICK, language }} />);
      expect(screen.queryByRole("button", { name: "Try it yourself" })).not.toBeInTheDocument();
      unmount();
    }
    // ...or when the language is unknown (a concept cached before it was recorded).
    const { language: _language, ...legacy } = QUICK;
    render(<ConceptPanel concept={legacy} />);
    expect(screen.queryByRole("button", { name: "Try it yourself" })).not.toBeInTheDocument();
  });
});

describe("reporting a problem with the lesson", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the topic and step with the learner's words", async () => {
    const user = userEvent.setup();
    render(<ConceptLesson concept={LESSON} onFinish={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));

    await user.click(screen.getByRole("button", { name: "Something unclear or wrong?" }));
    await user.type(screen.getByRole("textbox", { name: "Something unclear or wrong?" }), "The example never closes the tag");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/that helps us fix the lesson/)).toBeInTheDocument();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("/api/feedback");
    const sent = JSON.parse(init!.body as string);
    expect(sent.category).toBe("bug");
    expect(sent.message).toContain("[Lesson report] Headings / What is a tag?");
    expect(sent.message).toContain("The example never closes the tag");
  });

  it("won't send an empty report, and says so when sending fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    const user = userEvent.setup();
    render(<ConceptPanel concept={QUICK} />);

    await user.click(screen.getByRole("button", { name: "Something unclear or wrong?" }));
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "wrong");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled(); // can retry
  });
});

describe("ConceptPanel: focusing a section", () => {
  it("highlights and scrolls to the section the learner should revisit", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<ConceptPanel concept={LESSON} focusHeading="Common mistakes" />);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      const focused = screen.getByRole("heading", { name: "Common mistakes" }).closest("div[class*='ring-1']");
      expect(focused).not.toBeNull();
      expect(screen.getByRole("heading", { name: "What is a tag?" }).closest("div[class*='ring-1']")).toBeNull();
    } finally {
      // @ts-expect-error - jsdom doesn't implement it; restore to that
      delete Element.prototype.scrollIntoView;
    }
  });
});

describe("lesson analytics", () => {
  beforeEach(() => trackMock.mockClear());
  const events = (name: string) => trackMock.mock.calls.filter(([n]) => n === name).map(([, p]) => p);

  it("records each step viewed, so drop-off shows where people stop", async () => {
    const user = userEvent.setup();
    render(<ConceptLesson concept={LESSON} onFinish={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(events("lesson_step_viewed")).toEqual([
      { topic: "Headings", step: 1, total: 4 },
      { topic: "Headings", step: 2, total: 4 },
      { topic: "Headings", step: 3, total: 4 },
    ]);
  });

  it("records finishing, whichever kind of concept it was", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ConceptLesson concept={LESSON} onFinish={vi.fn()} />);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    expect(events("lesson_completed")).toEqual([{ topic: "Headings", kind: "lesson" }]);
    unmount();

    trackMock.mockClear();
    render(<ConceptLesson concept={QUICK} onFinish={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Start practicing" }));
    expect(events("lesson_completed")).toEqual([{ topic: "Headings", kind: "quick" }]);
    expect(events("lesson_step_viewed")).toEqual([]); // a single card has no steps
  });

  it("records the first answer to a check only, not later second thoughts", async () => {
    const user = userEvent.setup();
    render(<ConceptLesson concept={LESSON} onFinish={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));

    await user.click(screen.getByRole("radio", { name: "p" }));
    await user.click(screen.getByRole("radio", { name: "<p>" }));

    expect(events("lesson_check_answered")).toEqual([{ topic: "Headings", section: "What is a tag?", correct: false }]);
  });
});
