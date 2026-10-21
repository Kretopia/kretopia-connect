import { describe, expect, it } from "vitest";
import { loadEarliestActivity, loadRetrospectiveInputs, RETRO_ROW_LIMIT, type RetroClient } from "../passport/retrospectiveData";

type Chain = ReturnType<ReturnType<RetroClient["from"]>["select"]>;

type Call = { table: string; ops: Array<[string, unknown[]]> };

function fakeClient(rowsByTable: Record<string, unknown[] | { message: string }>) {
  const calls: Call[] = [];
  const client: RetroClient = {
    from: (table) => {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const q: Chain = new Proxy({} as Chain, {
        get: (_t, op: string | symbol) => {
          if (typeof op === "symbol") return undefined;
          if (op === "then") {
            const rows = rowsByTable[`${table}:${call.ops.some(([o, a]) => o === "eq" && a[0] === "endorser_id") ? "given" : "main"}`] ?? rowsByTable[table] ?? [];
            const result = Array.isArray(rows) ? { data: rows, error: null } : { data: null, error: rows };
            return (resolve: (v: unknown) => unknown) => resolve(result);
          }
          return (...args: unknown[]) => { call.ops.push([op, args]); return q; };
        },
      });
      return { select: (...args: unknown[]) => { call.ops.push(["select", args]); return q; } };
    },
  };
  return { client, calls };
}
const has = (call: Call, op: string, ...args: unknown[]) => call.ops.some(([o, a]) => o === op && args.every((x, i) => a[i] === x));

describe("loadRetrospectiveInputs", () => {
  it("asks only for the owner's rows, in the period, with UTC bounds", async () => {
    const { client, calls } = fakeClient({ credits: [{ created_at: "2026-02-01T00:00:00Z" }], "credit_endorsements:main": [{ responded_at: "2026-03-01T00:00:00Z" }], "credit_endorsements:given": [] });
    const out = await loadRetrospectiveInputs(client, "u1", 2026);
    expect(out.credits).toHaveLength(1);
    expect(out.received).toHaveLength(1);
    expect(out.given).toHaveLength(0);
    expect(out.truncated).toBe(false);

    const [credits, received, given] = calls;
    expect(credits.table).toBe("credits");
    expect(has(credits, "eq", "user_id", "u1")).toBe(true);
    expect(has(credits, "gte", "created_at", "2026-01-01T00:00:00.000Z")).toBe(true);
    expect(has(credits, "lt", "created_at", "2027-01-01T00:00:00.000Z")).toBe(true);

    expect(received.table).toBe("credit_endorsements");
    expect(has(received, "eq", "requested_by", "u1")).toBe(true);
    expect(has(received, "eq", "status", "accepted")).toBe(true);
    expect(has(received, "gte", "responded_at", "2026-01-01T00:00:00.000Z")).toBe(true);

    expect(has(given, "eq", "endorser_id", "u1")).toBe(true);
    expect(has(given, "neq", "requested_by", "u1")).toBe(true);
    expect(has(given, "eq", "status", "accepted")).toBe(true);
  });

  it("flags a result that reached the row cap instead of silently counting short", async () => {
    const many = Array.from({ length: RETRO_ROW_LIMIT }, () => ({ created_at: "2026-01-02T00:00:00Z" }));
    const { client } = fakeClient({ credits: many });
    expect((await loadRetrospectiveInputs(client, "u1", 2026)).truncated).toBe(true);
  });

  it("fails loudly, naming the part, rather than returning zeros", async () => {
    const { client } = fakeClient({ credits: { message: "permission denied" } });
    await expect(loadRetrospectiveInputs(client, "u1", 2026)).rejects.toThrow("credits: permission denied");
  });
});

describe("loadEarliestActivity", () => {
  it("returns the oldest credit date, or null when there is none", async () => {
    expect(await loadEarliestActivity(fakeClient({ credits: [{ created_at: "2023-04-05T00:00:00Z" }] }).client, "u1")).toBe("2023-04-05T00:00:00Z");
    expect(await loadEarliestActivity(fakeClient({ credits: [] }).client, "u1")).toBeNull();
  });
});
