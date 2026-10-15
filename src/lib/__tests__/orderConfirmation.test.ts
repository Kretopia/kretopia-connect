import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { claimOrderPaid } from "../../../supabase/functions/_shared/orderConfirmation";

type Order = { id: string; status: string; stripe_payment_intent_id: string | null };

// A tiny in-memory stand-in for the service-role client. Each call resolves one macrotask after it
// was issued, and an UPDATE is applied atomically when it resolves (like a guarded UPDATE in
// Postgres), so concurrent callers genuinely interleave.
function fakeDb(orders: Order[], opts: { failUpdate?: boolean; failRead?: boolean } = {}) {
  const table = new Map(orders.map((o) => [o.id, { ...o }]));
  const calls = { updates: 0 };
  const db = {
    from(_t: string) {
      let mode: "select" | "update" = "select";
      let patch: Partial<Order> = {};
      const eqs: Array<[string, unknown]> = [];
      const neqs: Array<[string, unknown]> = [];
      const q: any = {
        select() {
          return q;
        },
        update(p: Partial<Order>) {
          mode = "update";
          patch = p;
          return q;
        },
        eq(c: string, v: unknown) {
          eqs.push([c, v]);
          return q;
        },
        neq(c: string, v: unknown) {
          neqs.push([c, v]);
          return q;
        },
        maybeSingle() {
          if (opts.failRead) return Promise.resolve({ data: null, error: { message: "boom" } });
          const id = eqs.find(([c]) => c === "id")?.[1] as string;
          return new Promise((res) =>
            setTimeout(() => {
              const row = table.get(id);
              res({ data: row ? { status: row.status } : null, error: null });
            }, 0),
          );
        },
        then(resolveFn: (v: unknown) => void) {
          if (mode !== "update") return resolveFn({ data: null, error: null });
          if (opts.failUpdate) return resolveFn({ data: null, error: { message: "boom" } });
          return setTimeout(() => {
            const matched: Order[] = [];
            for (const row of table.values()) {
              const ok =
                eqs.every(([c, v]) => (row as any)[c] === v) && neqs.every(([c, v]) => (row as any)[c] !== v);
              if (ok) {
                Object.assign(row, patch);
                matched.push({ ...row });
                calls.updates += 1;
              }
            }
            resolveFn({ data: matched.map((r) => ({ id: r.id })), error: null });
          }, 0);
        },
      };
      return q;
    },
  };
  return { db, table, calls };
}

describe("claimOrderPaid", () => {
  it("turns a pending order paid and carries the patch", async () => {
    const { db, table } = fakeDb([{ id: "o1", status: "pending", stripe_payment_intent_id: null }]);
    expect(await claimOrderPaid(db, "o1", { stripe_payment_intent_id: "pi_1" })).toBe("claimed");
    expect(table.get("o1")).toMatchObject({ status: "paid", stripe_payment_intent_id: "pi_1" });
  });

  it("an order that is already paid is not claimed again and is left untouched", async () => {
    const { db, table, calls } = fakeDb([{ id: "o1", status: "paid", stripe_payment_intent_id: "pi_first" }]);
    expect(await claimOrderPaid(db, "o1", { stripe_payment_intent_id: "pi_second" })).toBe("already_paid");
    expect(table.get("o1")!.stripe_payment_intent_id).toBe("pi_first");
    expect(calls.updates).toBe(0);
  });

  it("an order that is gone is an error, never 'paid'", async () => {
    const { db } = fakeDb([]);
    expect(await claimOrderPaid(db, "missing")).toBe("error");
  });

  it("a failed write is an error", async () => {
    const { db, table } = fakeDb([{ id: "o1", status: "pending", stripe_payment_intent_id: null }], { failUpdate: true });
    expect(await claimOrderPaid(db, "o1")).toBe("error");
    expect(table.get("o1")!.status).toBe("pending");
  });

  it("if nothing changed and the order cannot be read back, it is an error", async () => {
    const { db } = fakeDb([{ id: "o1", status: "paid", stripe_payment_intent_id: null }], { failRead: true });
    expect(await claimOrderPaid(db, "o1")).toBe("error");
  });

  it("a status that is neither paid nor claimable is not reported as paid", async () => {
    // The guarded UPDATE matches any status other than 'paid', so this order is claimed, not skipped.
    const { db, table } = fakeDb([{ id: "o1", status: "cancelled", stripe_payment_intent_id: null }]);
    expect(await claimOrderPaid(db, "o1")).toBe("claimed");
    expect(table.get("o1")!.status).toBe("paid");
  });

  it("ten simultaneous verifications of one order: exactly one claims it", async () => {
    const { db, table } = fakeDb([{ id: "o1", status: "pending", stripe_payment_intent_id: null }]);
    const results = await Promise.all(Array.from({ length: 10 }, () => claimOrderPaid(db, "o1")));
    expect(results.filter((r) => r === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r === "already_paid")).toHaveLength(9);
    expect(table.get("o1")!.status).toBe("paid");
  });

  it("the counters are applied once however many verifications run together", async () => {
    const { db } = fakeDb([{ id: "o1", status: "pending", stripe_payment_intent_id: null }]);
    const counters = { quantitySold: 0, promoUses: 0 };
    const verify = async () => {
      if ((await claimOrderPaid(db, "o1")) !== "claimed") return;
      counters.quantitySold += 2;
      counters.promoUses += 1;
    };
    await Promise.all(Array.from({ length: 6 }, verify));
    expect(counters).toEqual({ quantitySold: 2, promoUses: 1 });
  });

  it("a different order is not affected by the first one's claim", async () => {
    const { db, table } = fakeDb([
      { id: "o1", status: "pending", stripe_payment_intent_id: null },
      { id: "o2", status: "pending", stripe_payment_intent_id: null },
    ]);
    expect(await claimOrderPaid(db, "o1")).toBe("claimed");
    expect(table.get("o2")!.status).toBe("pending");
    expect(await claimOrderPaid(db, "o2")).toBe("claimed");
  });
});

describe("verify-event-ticket wiring", () => {
  const src = readFileSync(resolve(__dirname, "../../../supabase/functions/verify-event-ticket/index.ts"), "utf8");
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it("imports the shared claim", () => {
    expect(src).toContain('from "../_shared/orderConfirmation.ts"');
  });

  it("still asks Stripe and requires a paid session before it claims anything", () => {
    expect(at("checkout.sessions.retrieve(")).toBeLessThan(at('session.payment_status !== "paid"'));
    expect(at('session.payment_status !== "paid"')).toBeLessThan(at("claimOrderPaid(admin"));
  });

  it("claims the paid transition before the capacity reservation and the promo increment", () => {
    const claim = at("claimOrderPaid(admin");
    expect(claim).toBeLessThan(at('rpc("reserve_event_ticket_capacity"'));
    expect(claim).toBeLessThan(at('rpc("increment_promo_use"'));
  });

  it("answers the loser of the claim before any counter is touched", () => {
    expect(at('claim === "already_paid"')).toBeLessThan(at('rpc("reserve_event_ticket_capacity"'));
    expect(at('claim === "error"')).toBeLessThan(at('rpc("reserve_event_ticket_capacity"'));
  });

  it("no longer writes `paid` after the counters (the claim is the only transition)", () => {
    const afterClaim = src.slice(at("claimOrderPaid(admin"));
    expect(afterClaim).not.toMatch(/status:\s*"paid"\s*,\s*\n\s*stripe_payment_intent_id/);
    expect(afterClaim).toContain("capacity_exceeded: true");
  });

  it("leaves the Stripe retrieval, the capacity RPC arguments and the seating untouched", () => {
    expect(src).toContain("apiVersion: \"2025-08-27.basil\"");
    expect(src).toContain('{ _tier_id: order.tier_id, _quantity: order.quantity }');
    expect(src).toContain('status: "going"');
    expect(src).toContain('{ onConflict: "jam_id,user_id" }');
  });
});
