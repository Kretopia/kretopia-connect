import { describe, expect, it } from "vitest";
import { dedupeLeads, splitEvenly } from "../../../supabase/functions/_shared/leadExtraction";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("splitEvenly", () => {
  it("splits a full result set into three equal chunks, in order, losing nothing", () => {
    const chunks = splitEvenly(range(36), 3);
    expect(chunks.map((c) => c.length)).toEqual([12, 12, 12]);
    expect(chunks.flat()).toEqual(range(36));
  });
  it("keeps small result sets in one call instead of fanning out", () => {
    expect(splitEvenly(range(5), 3)).toHaveLength(1);
    expect(splitEvenly(range(15), 3)).toHaveLength(1);
  });
  it("scales the number of chunks with the result count", () => {
    expect(splitEvenly(range(16), 3)).toHaveLength(2);
    expect(splitEvenly(range(24), 3)).toHaveLength(3);
  });
  it("never returns an empty chunk and handles empty input", () => {
    for (const n of [0, 1, 7, 8, 9, 23, 25, 36, 40]) {
      const chunks = splitEvenly(range(n), 3);
      expect(chunks.every((c) => c.length > 0)).toBe(true);
      expect(chunks.flat()).toEqual(range(n));
    }
    expect(splitEvenly([], 3)).toEqual([]);
  });
  it("respects a custom minimum chunk size", () => {
    expect(splitEvenly(range(10), 3, 2)).toHaveLength(3);
  });
});

describe("dedupeLeads", () => {
  it("keeps the first of two leads with the same email, ignoring case and spaces", () => {
    const out = dedupeLeads([
      { name: "A", email: "Ann@Co.com" },
      { name: "B", email: " ann@co.com " },
      { name: "C", email: "c@co.com" },
    ]);
    expect(out.map((l) => l.name)).toEqual(["A", "C"]);
  });
  it("falls back to name + company when there is no email", () => {
    const out = dedupeLeads([
      { name: "Ann Lee", company: "Acme" },
      { name: "ann lee", company: "ACME" },
      { name: "Ann Lee", company: "Other" },
    ]);
    expect(out).toHaveLength(2);
  });
  it("drops leads with no usable identity and keeps distinct people with the same name", () => {
    expect(dedupeLeads([{ name: "", company: "", email: "" }, { name: "  " }])).toEqual([]);
    expect(dedupeLeads([{ name: "Sam", email: "a@x.com" }, { name: "Sam", email: "b@x.com" }])).toHaveLength(2);
  });
});
