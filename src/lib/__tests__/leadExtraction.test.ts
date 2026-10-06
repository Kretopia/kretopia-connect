import { describe, expect, it } from "vitest";
import {
  dedupeLeads, isKnownLead, knownLeadKeys, leadKey, leadKeys, rememberLead, splitByExisting, splitEvenly,
} from "../../../supabase/functions/_shared/leadExtraction";

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

describe("leadKey / leadKeys", () => {
  it("uses the email when there is one, otherwise name + company", () => {
    expect(leadKey({ name: "Ann", company: "Acme", email: " Ann@Co.com " })).toBe("e:ann@co.com");
    expect(leadKey({ name: " Ann Lee ", company: "ACME" })).toBe("n:ann lee|acme");
    expect(leadKey({})).toBe("");
    expect(leadKey({ name: "  ", email: "" })).toBe("");
  });
  it("lists every way a lead can be recognised", () => {
    expect(leadKeys({ name: "Ann", company: "Acme", email: "a@co.com" })).toEqual(["e:a@co.com", "n:ann|acme"]);
    expect(leadKeys({ name: "Ann" })).toEqual(["n:ann|"]);
    expect(leadKeys({ email: "a@co.com" })).toEqual(["e:a@co.com"]);
  });
  it("copes with missing or non-string fields from the model", () => {
    expect(leadKey({ name: 42 as any, company: null, email: undefined })).toBe("n:42|");
  });
});

describe("splitByExisting (already in the user's leads)", () => {
  const saved = knownLeadKeys([
    { name: "Ann Lee", company: "Acme", email: "ann@acme.com" },
    { name: "Bo Chan", company: "Zed", email: null },
  ]);

  it("recognises a saved lead by email, ignoring case", () => {
    expect(isKnownLead({ name: "Someone Else", email: "ANN@acme.com" }, saved)).toBe(true);
  });
  it("recognises a saved lead by name + company even when the new copy has an email and the saved one has none", () => {
    expect(isKnownLead({ name: "bo chan", company: "ZED", email: "bo@zed.com" }, saved)).toBe(true);
  });
  it("recognises a saved lead by name + company when the new copy has no email", () => {
    expect(isKnownLead({ name: "Ann Lee", company: "Acme" }, saved)).toBe(true);
  });
  it("does not confuse the same name at a different company", () => {
    expect(isKnownLead({ name: "Ann Lee", company: "Other" }, saved)).toBe(false);
  });
  it("splits results into new and already-there, keeping order", () => {
    const { fresh, existing } = splitByExisting(
      [{ name: "New One", email: "n1@x.com" }, { name: "Ann Lee", company: "Acme" }, { name: "New Two" }, { name: "Bo", email: "ann@acme.com" }],
      saved,
    );
    expect(fresh.map((l) => l.name)).toEqual(["New One", "New Two"]);
    expect(existing.map((l) => l.name)).toEqual(["Ann Lee", "Bo"]);
  });
  it("rememberLead lets later items in the same batch be compared against earlier ones", () => {
    const seen = new Set<string>();
    const rows = [{ name: "A", email: "a@x.com" }, { name: "A2", email: "a@x.com" }, { name: "B" }];
    const kept = rows.filter((r) => {
      if (isKnownLead(r, seen)) return false;
      rememberLead(r, seen);
      return true;
    });
    expect(kept.map((r) => r.name)).toEqual(["A", "B"]);
  });
  it("treats an empty list of saved leads as nothing known", () => {
    expect(splitByExisting([{ name: "A" }], new Set()).fresh).toHaveLength(1);
  });
});
