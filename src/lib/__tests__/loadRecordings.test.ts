import { beforeEach, describe, expect, it, vi } from "vitest";

// Query builder: records the filters; the terminal `.is()` or the bare chain resolves from `plan`.
const plan = vi.hoisted(() => ({
  calls: [] as { usedRetentionFilter: boolean }[],
  respond: null as null | ((usedRetentionFilter: boolean) => { data: unknown; error: unknown }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const make = () => {
    let usedRetentionFilter = false;
    const chain: any = {
      select: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      is: (col: string) => {
        if (col === "recording_deleted_at") usedRetentionFilter = true;
        return chain;
      },
      then: (ok: any, bad: any) => {
        plan.calls.push({ usedRetentionFilter });
        return Promise.resolve(plan.respond!(usedRetentionFilter)).then(ok, bad);
      },
    };
    return chain;
  };
  return { supabase: { from: () => make() } };
});

import { isMissingRetentionColumn, loadRecordings, resetLoadRecordingsCache } from "../loadRecordings";

const missingColumn = { code: "42703", message: "column call_transcripts.recording_deleted_at does not exist" };
const row = (id: string) => ({ id, call_kind: "project", status: "failed", recording_id: `rec-${id}`, error: null });

beforeEach(() => {
  plan.calls = [];
  resetLoadRecordingsCache();
});

describe("loadRecordings", () => {
  it("lists the recordings when the backend has the retention column", async () => {
    plan.respond = () => ({ data: [row("a")], error: null });
    const r = await loadRecordings();
    expect(r.error).toBeNull();
    expect(r.rows.map((x) => x.id)).toEqual(["a"]);
    expect(plan.calls).toEqual([{ usedRetentionFilter: true }]);
  });

  it("still lists them when the backend lacks the column (production today): one retry without the filter", async () => {
    plan.respond = (filtered) => (filtered ? { data: null, error: missingColumn } : { data: [row("a"), row("b")], error: null });
    const r = await loadRecordings();
    expect(r.error).toBeNull();
    expect(r.rows).toHaveLength(2);
    expect(plan.calls).toEqual([{ usedRetentionFilter: true }, { usedRetentionFilter: false }]);
  });

  it("remembers that the column is missing instead of failing the first query on every load", async () => {
    plan.respond = (filtered) => (filtered ? { data: null, error: missingColumn } : { data: [row("a")], error: null });
    await loadRecordings();
    plan.calls = [];
    await loadRecordings();
    expect(plan.calls).toEqual([{ usedRetentionFilter: false }]);
  });

  it("an unrelated error is reported as an error, never as an empty list", async () => {
    plan.respond = () => ({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
    const r = await loadRecordings();
    expect(r).toEqual({ rows: [], error: "JWT expired" });
    expect(plan.calls).toHaveLength(1);
  });

  it("an error on the fallback query is reported too", async () => {
    plan.respond = (filtered) => ({ data: null, error: filtered ? missingColumn : { message: "boom" } });
    expect(await loadRecordings()).toEqual({ rows: [], error: "boom" });
  });

  it("recognises the missing column by code or by name", () => {
    expect(isMissingRetentionColumn(missingColumn)).toBe(true);
    expect(isMissingRetentionColumn({ message: "column recording_deleted_at does not exist" })).toBe(true);
    expect(isMissingRetentionColumn({ code: "42703", message: "column x does not exist" })).toBe(true);
    expect(isMissingRetentionColumn({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isMissingRetentionColumn(null)).toBe(false);
  });
});
