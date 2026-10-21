import { describe, expect, it } from "vitest";
import { describeDraftOrigin, describeLeftOut, normalizeExtractedBrief, PROJECT_BRIEF_MAX, type DraftOriginInput } from "../projectDraft";

const NOW = new Date("2026-10-21T10:00:00Z");
const good = { project: { title: "Bali Carnival", summary: "A two-day beach festival." }, deliverables: [{ title: "Lock venue", description: "Permits first.", due_date: "2026-11-30" }] };

describe("normalizeExtractedBrief", () => {
  it("keeps a well-formed answer as it is", () => {
    const result = normalizeExtractedBrief(good, NOW)!;
    expect(result.brief).toEqual({ project: { title: "Bali Carnival", summary: "A two-day beach festival." }, deliverables: [{ title: "Lock venue", description: "Permits first.", due_date: "2026-11-30" }] });
    expect(result.skippedTasks).toBe(0);
    expect(result.droppedDates).toBe(0);
  });

  it.each([
    ["nothing", null],
    ["a string", "a plain sentence"],
    ["an array", [good]],
    ["no project", { deliverables: [] }],
    ["a project that is not an object", { project: "Bali", deliverables: [] }],
    ["a title that is not text", { project: { title: 42, summary: "x" } }],
    ["a blank title", { project: { title: "   \n\t", summary: "x" } }],
  ])("returns null for %s, so the caller can fall back to the person's own words", (_name, raw) => {
    expect(normalizeExtractedBrief(raw, NOW)).toBeNull();
  });

  it("copes with a missing or wrong-typed summary and a deliverables field that is not a list", () => {
    expect(normalizeExtractedBrief({ project: { title: "A", summary: { nested: true } }, deliverables: "none" }, NOW)!.brief).toEqual({ project: { title: "A", summary: "" } });
  });

  it("drops tasks without a readable title, and repeats, and says how many", () => {
    const result = normalizeExtractedBrief({
      project: { title: "P", summary: "" },
      deliverables: [{ title: "Book the DJ" }, { title: "  " }, { description: "no title" }, "a string", null, 7, { title: "book the dj" }, { title: "Print posters" }],
    }, NOW)!;
    expect(result.brief.deliverables!.map((t) => t.title)).toEqual(["Book the DJ", "Print posters"]);
    expect(result.skippedTasks).toBe(6);
  });

  it("keeps at most eight tasks, in order, without counting the extra ones as unreadable", () => {
    const deliverables = Array.from({ length: 12 }, (_, i) => ({ title: `Task ${i + 1}` }));
    const result = normalizeExtractedBrief({ project: { title: "P", summary: "" }, deliverables }, NOW)!;
    expect(result.brief.deliverables).toHaveLength(8);
    expect(result.brief.deliverables![7].title).toBe("Task 8");
    expect(result.skippedTasks).toBe(0);
  });

  it("bounds lengths and removes control characters, so what the model wrote cannot break a column or a layout", () => {
    const result = normalizeExtractedBrief({
      project: { title: `Line one\nLine\u0000 two ${"x".repeat(300)}`, summary: `${"s".repeat(5000)}` },
      deliverables: [{ title: "T".repeat(400), description: "d".repeat(3000) }],
    }, NOW)!;
    expect(result.brief.project.title.length).toBeLessThanOrEqual(120);
    // eslint-disable-next-line no-control-regex
    expect(result.brief.project.title).not.toMatch(/[\n\u0000]/);
    expect(result.brief.project.summary).toHaveLength(2000);
    expect(result.brief.deliverables![0].title).toHaveLength(200);
    expect(result.brief.deliverables![0].description).toHaveLength(1000);
  });

  it("drops fields this flow does not use, whatever the model adds", () => {
    const result = normalizeExtractedBrief({
      project: { title: "P", summary: "", role: "admin", status: "published" },
      deliverables: [{ title: "T", references: [{ url: "javascript:alert(1)" }], notes: "n", assignee: "someone" }],
      permissions: { everyone: "owner" },
    }, NOW)!;
    expect(result.brief.project).toEqual({ title: "P", summary: "" });
    expect(Object.keys(result.brief.deliverables![0]).sort()).toEqual(["due_date", "title"]);
    expect(JSON.stringify(result)).not.toMatch(/admin|published|javascript|someone|permissions/);
  });

  describe("due dates, which the model cannot know", () => {
    const withDate = (due_date: unknown) => normalizeExtractedBrief({ project: { title: "P", summary: "" }, deliverables: [{ title: "T", due_date }] }, NOW)!;

    it("keeps a real date from today onwards, and a timestamp as its date", () => {
      expect(withDate("2026-10-21").brief.deliverables![0].due_date).toBe("2026-10-21");
      expect(withDate("2027-03-01T09:00:00.000Z").brief.deliverables![0].due_date).toBe("2027-03-01");
    });

    it.each([
      ["a date already past", "2026-10-20"],
      ["last year, which is what a model without a clock writes", "2025-08-15"],
      ["a date years away", "2031-01-01"],
      ["a date that does not exist", "2026-02-30"],
      ["words", "next Friday"],
      ["a bare number", "1"],
      ["something that is not text", 20261101],
    ])("leaves out %s and counts it", (_name, value) => {
      const result = withDate(value);
      expect(result.brief.deliverables![0].due_date).toBeNull();
      expect(result.droppedDates).toBe(1);
    });

    it("does not count a missing date as a dropped one", () => {
      expect(withDate(null).droppedDates).toBe(0);
      expect(withDate(undefined).droppedDates).toBe(0);
      expect(withDate("").droppedDates).toBe(0);
    });
  });
});

const input = (over: Partial<DraftOriginInput> = {}): DraftOriginInput => ({
  title: "Bali Carnival", summary: "A festival.", titleIsYours: false, summaryIsYours: false, rawText: "",
  taskCount: 6, roomTypeLabel: "Event", roomTypeIsYours: false, deadline: "", deadlineIsSuggested: false,
  budget: "", budgetIsSuggested: false, paymentsInvolved: null, paymentsAreSuggested: false, hasCover: false, ...over,
});
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("describeDraftOrigin", () => {
  it("sorts a fresh draft into what Kreto wrote and what is still missing, with nothing credited to the person", () => {
    const o = describeDraftOrigin(input());
    expect(ids(o.you)).toEqual([]);
    expect(ids(o.kreto)).toEqual(["title", "summary", "tasks", "type"]);
    expect(ids(o.missing)).toEqual(["deadline", "budget", "payments", "cover"]);
  });

  it("marks what blocks creation as required, and nothing else", () => {
    const required = describeDraftOrigin(input()).missing.filter((r) => r.required).map((r) => r.id);
    expect(required).toEqual(["payments", "cover"]);
    expect(describeDraftOrigin(input({ title: "  " })).missing.find((r) => r.id === "title")?.required).toBe(true);
  });

  it("credits the person with what they typed or tapped, and with their own words when Kreto could not structure them", () => {
    const o = describeDraftOrigin(input({ titleIsYours: true, summaryIsYours: true, roomTypeIsYours: true, deadline: "2026-12-01", budget: "$800", paymentsInvolved: false, hasCover: true }));
    expect(ids(o.you)).toEqual(["title", "summary", "type", "deadline", "budget", "payments", "cover"]);
    expect(ids(o.kreto)).toEqual(["tasks"]);
    expect(ids(o.missing)).toEqual([]);
  });

  it("keeps a suggested date a suggestion", () => {
    const o = describeDraftOrigin(input({ deadline: "2026-12-01", deadlineIsSuggested: true }));
    expect(o.kreto.find((r) => r.id === "deadline")?.value).toBe("2026-12-01");
    expect(ids(o.you)).not.toContain("deadline");
  });

  describe("a suggested budget or money answer", () => {
    it("counts as the person's own only when their own typed words say the same", () => {
      const o = describeDraftOrigin(input({ rawText: "Brand shoot for a client, budget $ 2,000.", budget: "$2,000", budgetIsSuggested: true, paymentsInvolved: true, paymentsAreSuggested: true }));
      expect(ids(o.you)).toEqual(["budget", "payments"]);
    });

    it("stays Kreto's when the amount appears only in what the model wrote", () => {
      const o = describeDraftOrigin(input({ rawText: "A swimwear shoot, next month.", budget: "$5k", budgetIsSuggested: true }));
      expect(ids(o.kreto)).toContain("budget");
      expect(ids(o.you)).not.toContain("budget");
    });

    it("stays Kreto's for a recording, a file or a sheet, where there are no typed words to check against", () => {
      const o = describeDraftOrigin(input({ rawText: "", budget: "$2,000", budgetIsSuggested: true, paymentsInvolved: true, paymentsAreSuggested: true }));
      expect(ids(o.kreto)).toEqual(expect.arrayContaining(["budget", "payments"]));
      expect(ids(o.you)).toEqual([]);
    });

    it("stays Kreto's when the person's words point the other way", () => {
      const o = describeDraftOrigin(input({ rawText: "A passion project, unpaid.", paymentsInvolved: true, paymentsAreSuggested: true }));
      expect(ids(o.kreto)).toContain("payments");
    });
  });

  it("shows the value of what is short enough to show", () => {
    const o = describeDraftOrigin(input({ budget: "$800", paymentsInvolved: true, hasCover: true }));
    expect(o.you.find((r) => r.id === "budget")?.value).toBe("$800");
    expect(o.you.find((r) => r.id === "payments")?.value).toBe("Yes");
    expect(o.kreto.find((r) => r.id === "tasks")?.value).toBe("6 drafted");
  });

  it("reports no tasks as missing, not as drafted", () => {
    expect(ids(describeDraftOrigin(input({ taskCount: 0 })).missing)).toContain("tasks");
  });
});

describe("the brief limit", () => {
  it("is a number the composer and the check share", () => {
    expect(PROJECT_BRIEF_MAX).toBe(4000);
  });
});

describe("describeLeftOut", () => {
  it("says nothing when nothing was left out", () => {
    expect(describeLeftOut(0, 0)).toEqual([]);
  });

  it("names what was left out and why, in the singular and the plural", () => {
    expect(describeLeftOut(1, 1)).toEqual([
      "1 drafted task was left out: no readable title, or a repeat.",
      "1 suggested due date was left out: not a real date or not in the future. Kreto doesn't know today's date.",
    ]);
    expect(describeLeftOut(3, 2).map((n) => n.slice(0, 40))).toEqual(["3 drafted tasks were left out: no readab", "2 suggested due dates were left out: not"]);
  });
});
