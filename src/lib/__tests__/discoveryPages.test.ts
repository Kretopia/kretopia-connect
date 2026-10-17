import { describe, expect, it, vi } from "vitest";
import { readDiscoveryPages } from "../discoveryPages";

describe("discovery replenishment", () => {
  it("reaches unseen profiles beyond the first 1000 without duplicates", async () => {
    const pool = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const read = vi.fn(async (from: number, to: number) => ({ data: pool.slice(from, to + 1), error: null }));
    const result = await readDiscoveryPages(read);
    expect(result.data).toHaveLength(1201);
    expect(new Set(result.data.map(r => r.id)).size).toBe(1201);
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("continues past dismissed gigs until usable suggestions exist", async () => {
    const pool = Array.from({ length: 80 }, (_, id) => ({ id, dismissed: id < 40 }));
    const result = await readDiscoveryPages(async (from, to) => ({ data: pool.slice(from, to + 1), error: null }), {
      pageSize: 40, enough: rows => rows.filter(r => !r.dismissed).length >= 20,
    });
    expect(result.data.filter(r => !r.dismissed)).toHaveLength(40);
  });
  it("preserves a read failure instead of returning partial success", async () => {
    const error = new Error("read failed");
    const result = await readDiscoveryPages(async from => from === 0
      ? { data: [1, 2], error: null } : { data: null, error }, { pageSize: 2 });
    expect(result.error).toBe(error);
    expect(result.data).toEqual([]);
  });
});