import { describe, expect, it, vi } from "vitest";
import { commitBudget, releaseBudget, reserveBudget, withBudget } from "../../../supabase/functions/_shared/durableBudget";

const ID = "3f2b8a64-5b7c-4c0e-9d8a-1a2b3c4d5e6f";
const REQ = { bucket: "invoice-mail:actor:u1", windowSeconds: 3600, limit: 30 };
const granted = { allowed: true, reservation_id: ID, used: 3, reserved: 1, remaining: 26 };

const db = (answers: Record<string, unknown> | ((name: string, args: Record<string, unknown>) => unknown)) => ({
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpc(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    const a = typeof answers === "function" ? answers(name, args) : answers[name];
    return Promise.resolve(a as { data: unknown; error: unknown });
  },
});

describe("reserveBudget: reserve first, and fail closed", () => {
  it("passes the request to the database function with its defaults and returns the grant", async () => {
    const client = db({ reserve_budget: { data: [granted], error: null } });
    expect(await reserveBudget(client, REQ)).toEqual({ ok: true, reservationId: ID, used: 3, reserved: 1, remaining: 26 });
    expect(client.calls).toEqual([{ name: "reserve_budget", args: { p_bucket: REQ.bucket, p_window_seconds: 3600, p_limit: 30, p_units: 1, p_ttl_seconds: 300 } }]);
  });

  it("answers 429 when the budget is spent", async () => {
    const client = db({ reserve_budget: { data: [{ allowed: false, reservation_id: null, used: 30, reserved: 0, remaining: 0 }], error: null } });
    expect(await reserveBudget(client, REQ)).toEqual({ ok: false, status: 429, reason: "exhausted" });
  });

  it("answers 503, reserving nothing, when the database cannot answer: missing function, outage, thrown error", async () => {
    for (const answer of [
      { data: null, error: { code: "PGRST202", message: "Could not find the function public.reserve_budget" } },
      { data: null, error: { code: "42501", message: "permission denied" } },
      { data: null, error: { message: "connection reset" } },
    ]) expect(await reserveBudget(db({ reserve_budget: answer }), REQ)).toEqual({ ok: false, status: 503, reason: "unavailable" });
    // An error wins over whatever data came with it: a grant-looking row next to an error is not a grant.
    expect(await reserveBudget(db({ reserve_budget: { data: [granted], error: { message: "partial failure" } } }), REQ)).toEqual({ ok: false, status: 503, reason: "unavailable" });
    const throwing = { rpc: () => { throw new Error("network"); } };
    expect(await reserveBudget(throwing, REQ)).toEqual({ ok: false, status: 503, reason: "unavailable" });
    const rejecting = { rpc: () => Promise.reject(new Error("network")) };
    expect(await reserveBudget(rejecting, REQ)).toEqual({ ok: false, status: 503, reason: "unavailable" });
  });

  it("never reads an answer it does not understand as a grant", async () => {
    for (const data of [
      null, undefined, [], "ok", 5, true, {},
      [{ allowed: "true", reservation_id: ID, used: 0, reserved: 1, remaining: 1 }],
      [{ allowed: 1, reservation_id: ID, used: 0, reserved: 1, remaining: 1 }],
      [{ allowed: true, reservation_id: null, used: 0, reserved: 1, remaining: 1 }],
      [{ allowed: true, reservation_id: "not-a-uuid", used: 0, reserved: 1, remaining: 1 }],
      [{ allowed: true, reservation_id: ID, used: -1, reserved: 1, remaining: 1 }],
      [{ allowed: true, reservation_id: ID, used: "3", reserved: 1, remaining: 1 }],
      [{ allowed: true, reservation_id: ID, used: 0, reserved: 1.5, remaining: 1 }],
      [{ allowed: true, reservation_id: ID, used: 0, reserved: 1 }],
    ]) expect(await reserveBudget(db({ reserve_budget: { data, error: null } }), REQ)).toEqual({ ok: false, status: 503, reason: "unavailable" });
  });

  it("accepts a single object answer as well as a one-row array", async () => {
    expect((await reserveBudget(db({ reserve_budget: { data: granted, error: null } }), REQ)).ok).toBe(true);
  });
});

describe("commitBudget / releaseBudget: settled at most once", () => {
  it("is true only when the database says it settled the reservation", async () => {
    expect(await commitBudget(db({ commit_budget: { data: true, error: null } }), ID)).toBe(true);
    expect(await commitBudget(db({ commit_budget: { data: false, error: null } }), ID)).toBe(false);
    expect(await releaseBudget(db({ release_budget: { data: true, error: null } }), ID)).toBe(true);
    expect(await releaseBudget(db({ release_budget: { data: false, error: null } }), ID)).toBe(false);
  });
  it("is false on an error or an odd answer, and never throws", async () => {
    expect(await commitBudget(db({ commit_budget: { data: true, error: { message: "x" } } }), ID)).toBe(false);
    expect(await commitBudget(db({ commit_budget: { data: "true", error: null } }), ID)).toBe(false);
    expect(await releaseBudget({ rpc: () => { throw new Error("boom"); } }, ID)).toBe(false);
    expect(await commitBudget({ rpc: () => Promise.reject(new Error("boom")) }, ID)).toBe(false);
  });
  it("sends the reservation id and nothing else", async () => {
    const client = db({ commit_budget: { data: true, error: null } });
    await commitBudget(client, ID);
    expect(client.calls).toEqual([{ name: "commit_budget", args: { p_reservation: ID } }]);
  });
});

describe("withBudget: the action never starts without a reservation", () => {
  const answers = (over: Record<string, unknown> = {}) => db({ reserve_budget: { data: [granted], error: null }, commit_budget: { data: true, error: null }, release_budget: { data: true, error: null }, ...over });

  it("reserves, runs, commits", async () => {
    const client = answers();
    const action = vi.fn().mockResolvedValue("sent");
    expect(await withBudget(client, REQ, action)).toEqual({ ok: true, value: "sent" });
    expect(client.calls.map((c) => c.name)).toEqual(["reserve_budget", "commit_budget"]);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("releases the reservation and rethrows when the action throws", async () => {
    const client = answers();
    await expect(withBudget(client, REQ, async () => { throw new Error("provider down"); })).rejects.toThrow("provider down");
    expect(client.calls.map((c) => c.name)).toEqual(["reserve_budget", "release_budget"]);
  });

  it("does not run the action when the budget is spent or cannot be checked", async () => {
    for (const [reserve, status] of [
      [{ data: [{ allowed: false }], error: null }, 429],
      [{ data: null, error: { code: "PGRST202" } }, 503],
    ] as const) {
      const action = vi.fn();
      const client = answers({ reserve_budget: reserve });
      expect(await withBudget(client, REQ, action)).toMatchObject({ ok: false, status });
      expect(action).not.toHaveBeenCalled();
      expect(client.calls.map((c) => c.name)).toEqual(["reserve_budget"]);
    }
  });

  it("still returns the result when the commit fails: the action ran, the reservation expires by itself", async () => {
    const client = answers({ commit_budget: { data: null, error: { message: "down" } } });
    expect(await withBudget(client, REQ, async () => 42)).toEqual({ ok: true, value: 42 });
  });
});
