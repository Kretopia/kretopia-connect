import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ select: vi.fn(), upsert: vi.fn(), tables: [] as string[] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      m.tables.push(table);
      return { select: () => ({ eq: () => m.select() }), upsert: (...args: unknown[]) => m.upsert(...args) };
    },
  },
}));

import {
  EVENT_SECTION_KEYS, SECTION_LIMITS, emptySections, fetchEventSections, hasCustomContent, rowForSection, saveEventSections, sectionsFromRows, validateSections, viewSection,
  type EventSections,
} from "../eventSections";

const missing = { code: "PGRST205", message: "Could not find the table 'public.event_page_sections' in the schema cache" };

beforeEach(() => {
  m.tables.length = 0;
  m.select.mockReset().mockResolvedValue({ data: [], error: null });
  m.upsert.mockReset().mockResolvedValue({ error: null });
});

const written = (over: Partial<Record<"program" | "venue" | "policies", string>> = {}): EventSections => {
  const s = emptySections();
  s.program = { visible: true, text: "19:00 Doors\n20:00 Live set", faq: [], stored: true, ...(over.program ? { text: over.program } : {}) };
  s.venue = { visible: true, text: over.venue ?? "Use the side entrance.", faq: [], stored: true };
  s.policies = { visible: true, text: over.policies ?? "No refunds.", faq: [], stored: true };
  s.faq = { visible: true, text: "", faq: [{ question: "Parking?", answer: "Behind the venue." }], stored: true };
  return s;
};

describe("old events keep their defaults", () => {
  it("an event with no rows has every section visible, unwritten and unstored", () => {
    const s = sectionsFromRows([]);
    for (const key of EVENT_SECTION_KEYS) {
      expect(s[key]).toMatchObject({ visible: true, stored: false, text: "", faq: [] });
      expect(hasCustomContent(key, s[key])).toBe(false);
      expect(viewSection(key, s[key], false)).toEqual({ show: true, custom: false, hiddenFromVisitors: false });
    }
  });

  it("ignores rows it does not know and tolerates malformed content", () => {
    const s = sectionsFromRows([
      { section: "unknown", content: { text: "x" }, is_visible: true },
      { section: "program", content: "not an object", is_visible: true },
      { section: "faq", content: { items: [{ question: "Q", answer: "A" }, { nope: true }, null] }, is_visible: true },
    ]);
    expect(s.program).toMatchObject({ stored: true, text: "" });
    expect(s.faq.faq).toEqual([{ question: "Q", answer: "A" }]);
  });
});

describe("show and hide", () => {
  const hiddenProgram = () => sectionsFromRows([{ section: "program", content: { text: "19:00 Doors" }, is_visible: false }]);

  it("a visitor gets nothing of a hidden section, and the host gets it marked", () => {
    const s = hiddenProgram();
    expect(viewSection("program", s.program, false)).toEqual({ show: false, custom: true, hiddenFromVisitors: true });
    expect(viewSection("program", s.program, true)).toEqual({ show: true, custom: true, hiddenFromVisitors: true });
  });

  it("hiding keeps the words: turning the section back on shows what the host wrote", () => {
    const s = hiddenProgram();
    expect(s.program.text).toBe("19:00 Doors");
    s.program.visible = true;
    expect(viewSection("program", s.program, false)).toEqual({ show: true, custom: true, hiddenFromVisitors: false });
  });

  it("the stored row for a hidden section keeps its content and says it is hidden", () => {
    const s = written();
    s.program.visible = false;
    const row = rowForSection("e1", "program", s.program, "host");
    expect(row).toMatchObject({ event_id: "e1", section: "program", is_visible: false, content: { text: "19:00 Doors\n20:00 Live set" }, updated_by: "host" });
  });
});

describe("what is stored", () => {
  it("whitespace-only text is stored as empty, so the default comes back, and FAQ entries are trimmed", () => {
    const s = written({ policies: "   \n " });
    expect(rowForSection("e1", "policies", s.policies, "h").content).toEqual({ text: "" });
    s.faq.faq = [{ question: "  Parking? ", answer: " Behind. " }];
    expect(rowForSection("e1", "faq", s.faq, "h").content).toEqual({ items: [{ question: "Parking?", answer: "Behind." }] });
  });

  it("limits what can be written, in the same words the form shows", () => {
    expect(validateSections(written())).toBeNull();
    expect(validateSections(written({ program: "x".repeat(SECTION_LIMITS.text + 1) }))).toMatch(/Program \/ line-up can have at most 4000/);
    const tooMany = written();
    tooMany.faq.faq = Array.from({ length: SECTION_LIMITS.faqItems + 1 }, (_, i) => ({ question: `Q${i}`, answer: "A" }));
    expect(validateSections(tooMany)).toMatch(/at most 20 questions/);
    const half = written();
    half.faq.faq = [{ question: "Q only", answer: "" }];
    expect(validateSections(half)).toMatch(/needs a question and an answer/);
    const longQ = written();
    longQ.faq.faq = [{ question: "Q".repeat(SECTION_LIMITS.question + 1), answer: "A" }];
    expect(validateSections(longQ)).toMatch(/question can have at most 200/);
  });
});

describe("saving and loading", () => {
  it("saves all four sections for the signed-in host, in one write to the sections table only", async () => {
    const result = await saveEventSections("e1", "host", written());
    expect(result).toEqual({ ok: true });
    expect(m.tables).toEqual(["event_page_sections"]);
    const [rows, options] = m.upsert.mock.calls[0];
    expect(rows).toHaveLength(4);
    expect(rows.map((r: { section: string }) => r.section).sort()).toEqual(["faq", "policies", "program", "venue"]);
    expect(options).toEqual({ onConflict: "event_id,section" });
  });

  it("refuses an invalid or signed-out save before anything is sent", async () => {
    expect(await saveEventSections("e1", null, written())).toMatchObject({ ok: false, reason: "signed-out" });
    expect(await saveEventSections("e1", "host", written({ venue: "v".repeat(5000) }))).toMatchObject({ ok: false, reason: "invalid" });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("says editing is unavailable, not saved, while the table does not exist; any other failure keeps the server's words", async () => {
    m.upsert.mockResolvedValue({ error: missing });
    expect(await saveEventSections("e1", "host", written())).toMatchObject({ ok: false, reason: "unavailable" });
    m.upsert.mockResolvedValue({ error: { code: "42501", message: "new row violates row-level security policy" } });
    expect(await saveEventSections("e1", "someone-else", written())).toMatchObject({ ok: false, reason: "failed", message: "new row violates row-level security policy" });
  });

  it("loads the rows the database returns, and falls back to the defaults when the table is missing or unreadable", async () => {
    m.select.mockResolvedValue({ data: [{ section: "venue", content: { text: "Side entrance." }, is_visible: true }], error: null });
    const ok = await fetchEventSections("e1");
    expect(ok).toMatchObject({ available: true, loadFailed: false });
    expect(ok.sections.venue.text).toBe("Side entrance.");
    m.select.mockResolvedValue({ data: null, error: missing });
    expect(await fetchEventSections("e1")).toMatchObject({ available: false, loadFailed: false });
    m.select.mockResolvedValue({ data: null, error: { code: "08006", message: "connection lost" } });
    const failed = await fetchEventSections("e1");
    expect(failed).toMatchObject({ available: true, loadFailed: true });
    expect(failed.sections.program.stored).toBe(false);
  });
});

describe("who reads what", () => {
  it("a visitor reads the redacting public view, the host reads the table that holds every section", async () => {
    await fetchEventSections("e1");
    await fetchEventSections("e1", false);
    await fetchEventSections("e1", true);
    expect(m.tables).toEqual(["event_page_sections_public", "event_page_sections_public", "event_page_sections"]);
  });

  it("a hidden section reaches a visitor as a flag with no words, so nothing of it is drawn, and the host can still see what it says", async () => {
    // What the view returns for a hidden Venue section: the flag, and the content blanked by the database.
    m.select.mockResolvedValue({ data: [{ section: "venue", content: {}, is_visible: false }], error: null });
    const visitor = await fetchEventSections("e1");
    expect(visitor.sections.venue).toMatchObject({ visible: false, text: "", stored: true });
    expect(viewSection("venue", visitor.sections.venue, false)).toEqual({ show: false, custom: false, hiddenFromVisitors: true });

    // What the table returns to the host for the same section: the words are still there, marked as hidden.
    m.select.mockResolvedValue({ data: [{ section: "venue", content: { text: "Use the side entrance." }, is_visible: false }], error: null });
    const host = await fetchEventSections("e1", true);
    expect(viewSection("venue", host.sections.venue, true)).toEqual({ show: true, custom: true, hiddenFromVisitors: true });
    expect(host.sections.venue.text).toBe("Use the side entrance.");
  });
});
