import { describe, expect, it } from "vitest";
import {
  analyzeCurriculum,
  findNextTopic,
  isAdHocTopic,
  usesStrictOrder,
  type CurriculumTopic,
  type TopicFacts,
} from "./curriculum";

// The HTML/CSS path from the bug report, in path order. Note the AI gave Flexbox no prerequisites.
const PATH: CurriculumTopic[] = [
  { _id: "html", externalId: "html", orderIndex: 0, prerequisiteExternalIds: [] },
  { _id: "selectors", externalId: "selectors", orderIndex: 1, prerequisiteExternalIds: [] },
  { _id: "flexbox", externalId: "flexbox", orderIndex: 2, prerequisiteExternalIds: [] },
];

const facts = (entries: Record<string, Partial<TopicFacts>>) =>
  new Map(Object.entries(entries).map(([id, f]) => [id, { learned: false, ...f } as TopicFacts]));

const analyze = (
  topics: CurriculumTopic[],
  f: Record<string, Partial<TopicFacts>>,
  strictOrder: boolean
) => analyzeCurriculum(topics, facts(f), { strictOrder });

describe("usesStrictOrder", () => {
  it("applies to beginners only", () => {
    expect(usesStrictOrder("beginner")).toBe(true);
    for (const level of ["junior", "intermediate", "advanced", undefined, null]) {
      expect(usesStrictOrder(level)).toBe(false);
    }
  });
});

describe("passed", () => {
  it("is earned by mastering a topic or by finishing a Learn session on it", () => {
    const a = analyze(PATH, { html: { status: "mastered" }, selectors: { learned: true } }, false);
    expect(a.get("html")!.passed).toBe(true);
    expect(a.get("selectors")!.passed).toBe(true);
  });

  it("is NOT earned by practising: attempts and an in-progress status leave a topic unpassed", () => {
    const a = analyze(PATH, { flexbox: { status: "in_progress" }, html: { status: "needs_review" } }, false);
    expect(a.get("flexbox")!.passed).toBe(false);
    expect(a.get("html")!.passed).toBe(false);
  });
});

describe("strict order (beginners)", () => {
  it("blocks everything after the first topic that isn't passed - the bug report's Flexbox-before-HTML case", () => {
    const a = analyze(PATH, { flexbox: { status: "in_progress" } }, true);

    expect(a.get("html")).toMatchObject({ block: null }); // the first topic is always open
    expect(a.get("selectors")).toMatchObject({ block: "order", blockedBy: ["html"] });
    expect(a.get("flexbox")).toMatchObject({ block: "order", blockedBy: ["html"] }); // practising it changed nothing
  });

  it("opens the next topic as each one is passed", () => {
    const a = analyze(PATH, { html: { learned: true } }, true);
    expect(a.get("selectors")!.block).toBeNull();
    expect(a.get("flexbox")).toMatchObject({ block: "order", blockedBy: ["selectors"] }); // points at the CLOSEST unfinished topic
  });

  it("opens the whole path once everything before is passed", () => {
    const a = analyze(PATH, { html: { learned: true }, selectors: { status: "mastered" } }, true);
    expect(a.get("flexbox")!.block).toBeNull();
  });

  it("does not leave a later topic open just because it was mastered out of order", () => {
    const a = analyze(PATH, { flexbox: { status: "mastered" } }, true);
    expect(a.get("flexbox")).toMatchObject({ passed: true, block: "order" });
  });
});

describe("free order (everyone else)", () => {
  it("does not block topics that have no prerequisites, whatever the order", () => {
    const a = analyze(PATH, {}, false);
    expect([...a.values()].every((x) => x.block === null)).toBe(true);
  });

  it("still honours the AI's prerequisites", () => {
    const withPrereq: CurriculumTopic[] = [
      PATH[0]!,
      { ...PATH[1]!, prerequisiteExternalIds: ["html"] },
      PATH[2]!,
    ];
    const a = analyze(withPrereq, {}, false);
    expect(a.get("selectors")).toMatchObject({ block: "prerequisites", blockedBy: ["html"] });
    expect(a.get("flexbox")!.block).toBeNull();

    const passed = analyze(withPrereq, { html: { learned: true } }, false);
    expect(passed.get("selectors")!.block).toBeNull();
  });

  it("lists every unmet prerequisite, and only the unmet ones", () => {
    const topics: CurriculumTopic[] = [
      PATH[0]!,
      PATH[1]!,
      { ...PATH[2]!, prerequisiteExternalIds: ["html", "selectors"] },
    ];
    const a = analyze(topics, { html: { learned: true } }, false);
    expect(a.get("flexbox")).toMatchObject({ block: "prerequisites", blockedBy: ["selectors"] });
  });
});

describe("prerequisite hygiene", () => {
  it("ignores a prerequisite that points at itself or at a LATER topic, which would deadlock the path", () => {
    const topics: CurriculumTopic[] = [
      { ...PATH[0]!, prerequisiteExternalIds: ["flexbox"] }, // first topic waiting on the last one
      { ...PATH[1]!, prerequisiteExternalIds: ["selectors"] }, // itself
      { ...PATH[2]!, prerequisiteExternalIds: ["html"] },
    ];
    const a = analyze(topics, {}, false);
    expect(a.get("html")!.block).toBeNull();
    expect(a.get("selectors")!.block).toBeNull();
    expect(a.get("flexbox")).toMatchObject({ block: "prerequisites", blockedBy: ["html"] });
  });

  it("ignores prerequisites that name topics that don't exist", () => {
    const topics: CurriculumTopic[] = [{ ...PATH[0]!, prerequisiteExternalIds: ["ghost"] }];
    expect(analyze(topics, {}, false).get("html")!.block).toBeNull();
  });

  it("never blocks the first topic that isn't passed, so there is always somewhere to go", () => {
    // A path where every topic names every earlier one as a prerequisite, strict order, nothing done.
    const chain: CurriculumTopic[] = PATH.map((t, i) => ({
      ...t,
      prerequisiteExternalIds: PATH.slice(0, i).map((p) => p.externalId),
    }));
    for (const strict of [true, false]) {
      const a = analyze(chain, {}, strict);
      expect(findNextTopic(chain, a)?._id).toBe("html");
      expect(a.get("html")!.block).toBeNull();
    }
  });
});

describe("path order", () => {
  it("visits a parent before its children, then the next root, regardless of input order", () => {
    const topics: CurriculumTopic[] = [
      { _id: "css", externalId: "css", orderIndex: 3, prerequisiteExternalIds: [] },
      { _id: "tags", externalId: "tags", orderIndex: 1, parentTopicId: "html", prerequisiteExternalIds: [] },
      { _id: "html", externalId: "html", orderIndex: 0, prerequisiteExternalIds: [] },
      { _id: "semantics", externalId: "semantics", orderIndex: 2, parentTopicId: "html", prerequisiteExternalIds: [] },
    ];
    const a = analyze(topics, {}, true);
    expect(a.get("tags")).toMatchObject({ block: "order", blockedBy: ["html"] });
    expect(findNextTopic(topics, a)?._id).toBe("html");

    const later = analyze(topics, { html: { learned: true }, tags: { learned: true } }, true);
    expect(findNextTopic(topics, later)?._id).toBe("semantics");
    expect(later.get("css")).toMatchObject({ block: "order", blockedBy: ["semantics"] });
  });
});

describe("ad-hoc practice topics", () => {
  const adHoc: CurriculumTopic = {
    _id: "custom",
    externalId: "css-flexbox-layouts",
    orderIndex: 99,
    prerequisiteExternalIds: [],
    adHoc: true,
  };

  it("are recognised by the flag, and by the summary older ones were created with", () => {
    expect(isAdHocTopic({ adHoc: true })).toBe(true);
    expect(isAdHocTopic({ summary: "Practice topic: CSS Flexbox layouts" })).toBe(true);
    expect(isAdHocTopic({ summary: "How to structure a page." })).toBe(false);
    expect(isAdHocTopic({})).toBe(false);
  });

  it("are never blocked, even for a beginner with nothing passed", () => {
    const a = analyze([...PATH, adHoc], {}, true);
    expect(a.get("custom")).toMatchObject({ block: null, blockedBy: [] });
  });

  it("do not take part in the order or in 'next topic'", () => {
    const a = analyze([adHoc, ...PATH], { html: { learned: true }, selectors: { learned: true }, flexbox: { learned: true } }, true);
    expect(findNextTopic([adHoc, ...PATH], a)).toBeNull(); // the path is complete; the sandbox topic isn't a step
    // ...and one being unfinished doesn't hold anything up.
    expect(a.get("flexbox")!.block).toBeNull();
  });
});

describe("findNextTopic", () => {
  it("is the first topic in path order that isn't passed", () => {
    const a = analyze(PATH, { html: { learned: true }, flexbox: { status: "in_progress" } }, false);
    expect(findNextTopic(PATH, a)?._id).toBe("selectors"); // not Flexbox, though it has activity
  });

  it("skips a later topic that was legitimately passed", () => {
    const a = analyze(PATH, { html: { learned: true }, selectors: { status: "mastered" } }, false);
    expect(findNextTopic(PATH, a)?._id).toBe("flexbox");
  });

  it("is null once every topic is passed, and for an empty path", () => {
    const all = analyze(PATH, { html: { learned: true }, selectors: { learned: true }, flexbox: { learned: true } }, true);
    expect(findNextTopic(PATH, all)).toBeNull();
    expect(findNextTopic([], new Map())).toBeNull();
  });
});
