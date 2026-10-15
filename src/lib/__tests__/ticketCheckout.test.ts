import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_TICKETS_PER_ORDER,
  PENDING_ORDER_HOLD_MINUTES,
  claimPromoUse,
  cleanQuantity,
  promoHasRoom,
  releasePromoUse,
} from "../../../supabase/functions/_shared/ticketCheckout";

// A tiny in-memory stand-in for the service-role client. A read resolves from the value it saw when
// it was issued, one macrotask later, so concurrent claimers all read the same stale count; a write
// is applied atomically when it resolves, which is what a compare-and-set UPDATE does in Postgres.
type Row = { id: string; uses_count: number; max_uses: number | null };

function fakeDb(rows: Row[], opts: { failUpdate?: boolean; failSelect?: boolean; dropRow?: boolean } = {}) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const log = { updates: 0 };
  const db = {
    from(_t: string) {
      let mode: "select" | "update" = "select";
      let patch: Partial<Row> = {};
      const filters: Array<[string, unknown]> = [];
      const q: any = {
        select() {
          return q;
        },
        update(p: Partial<Row>) {
          mode = "update";
          patch = p;
          return q;
        },
        eq(c: string, v: unknown) {
          filters.push([c, v]);
          return q;
        },
        maybeSingle() {
          if (opts.failSelect) return Promise.resolve({ data: null, error: { message: "boom" } });
          const id = filters.find(([c]) => c === "id")?.[1] as string;
          const seen = opts.dropRow ? null : table.get(id);
          const snap = seen ? { ...seen } : null;
          return new Promise((res) => setTimeout(() => res({ data: snap, error: null }), 0));
        },
        then(resolve: (v: unknown) => void) {
          if (mode !== "update") return resolve({ data: null, error: null });
          if (opts.failUpdate) return resolve({ data: null, error: { message: "boom" } });
          return setTimeout(() => {
            const matched: Row[] = [];
            for (const row of table.values()) {
              if (filters.every(([c, v]) => (row as any)[c] === v)) {
                Object.assign(row, patch);
                matched.push({ ...row });
                log.updates += 1;
              }
            }
            resolve({ data: matched.map((r) => ({ id: r.id })), error: null });
          }, 0);
        },
      };
      return q;
    },
  };
  return { db, table, log };
}

describe("cleanQuantity", () => {
  it("accepts whole numbers from 1 to 50", () => {
    expect(cleanQuantity(1)).toBe(1);
    expect(cleanQuantity(7)).toBe(7);
    expect(cleanQuantity(MAX_TICKETS_PER_ORDER)).toBe(50);
  });
  it("refuses fractions, zero, negatives, non-finite numbers and anything over 50", () => {
    for (const v of [1.5, 0.5, 0, -1, NaN, Infinity, -Infinity, 51, 1000, 2 ** 53]) {
      expect(cleanQuantity(v)).toBeNull();
    }
  });
  it("refuses values that are not numbers, including numeric strings", () => {
    for (const v of ["2", "2.0", "", null, undefined, {}, [], [2], true, "1e1"]) {
      expect(cleanQuantity(v)).toBeNull();
    }
  });
});

describe("promoHasRoom", () => {
  it("an unlimited code always has room", () => {
    expect(promoHasRoom({ maxUses: null, usesCount: 9999, inFlight: 9999 })).toBe(true);
    expect(promoHasRoom({ maxUses: undefined, usesCount: 5, inFlight: null })).toBe(true);
  });
  it("counts redeemed uses and pending orders together", () => {
    expect(promoHasRoom({ maxUses: 10, usesCount: 4, inFlight: 5 })).toBe(true);
    expect(promoHasRoom({ maxUses: 10, usesCount: 4, inFlight: 6 })).toBe(false);
    expect(promoHasRoom({ maxUses: 10, usesCount: 10, inFlight: 0 })).toBe(false);
    expect(promoHasRoom({ maxUses: 1, usesCount: 0, inFlight: 1 })).toBe(false);
    expect(promoHasRoom({ maxUses: 1, usesCount: 0, inFlight: 0 })).toBe(true);
  });
  it("a limited code whose pending count cannot be read has no room", () => {
    expect(promoHasRoom({ maxUses: 10, usesCount: 0, inFlight: null })).toBe(false);
  });
  it("the hold is a bounded number of minutes", () => {
    expect(PENDING_ORDER_HOLD_MINUTES).toBeGreaterThan(0);
    expect(PENDING_ORDER_HOLD_MINUTES).toBeLessThanOrEqual(60);
  });
});

describe("claimPromoUse", () => {
  it("takes one use of a code that has room", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 2, max_uses: 5 }]);
    expect(await claimPromoUse(db, "p")).toBe("claimed");
    expect(table.get("p")!.uses_count).toBe(3);
  });
  it("takes a use of an unlimited code", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 40, max_uses: null }]);
    expect(await claimPromoUse(db, "p")).toBe("claimed");
    expect(table.get("p")!.uses_count).toBe(41);
  });
  it("refuses a code that is used up, and writes nothing", async () => {
    const { db, table, log } = fakeDb([{ id: "p", uses_count: 5, max_uses: 5 }]);
    expect(await claimPromoUse(db, "p")).toBe("exhausted");
    expect(table.get("p")!.uses_count).toBe(5);
    expect(log.updates).toBe(0);
  });
  it("a code that cannot be read, or has vanished, is an error, not a grant", async () => {
    expect(await claimPromoUse(fakeDb([{ id: "p", uses_count: 0, max_uses: 5 }], { failSelect: true }).db, "p")).toBe("error");
    expect(await claimPromoUse(fakeDb([{ id: "p", uses_count: 0, max_uses: 5 }], { dropRow: true }).db, "p")).toBe("error");
  });
  it("a failed write is an error and takes no use", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 0, max_uses: 5 }], { failUpdate: true });
    expect(await claimPromoUse(db, "p")).toBe("error");
    expect(table.get("p")!.uses_count).toBe(0);
  });
  it("a corrupt count is an error", async () => {
    const { db } = fakeDb([{ id: "p", uses_count: Number.NaN, max_uses: 5 }]);
    expect(await claimPromoUse(db, "p")).toBe("error");
  });

  it("ten concurrent claims of the last use: exactly one wins, the count never passes the limit", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 4, max_uses: 5 }]);
    const results = await Promise.all(Array.from({ length: 10 }, () => claimPromoUse(db, "p")));
    expect(results.filter((r) => r === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r === "exhausted").length + results.filter((r) => r === "error").length).toBe(9);
    expect(table.get("p")!.uses_count).toBe(5);
  });

  it("concurrent claims of a single-use code never exceed the limit", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 0, max_uses: 1 }]);
    const results = await Promise.all(Array.from({ length: 25 }, () => claimPromoUse(db, "p")));
    expect(results.filter((r) => r === "claimed")).toHaveLength(1);
    expect(table.get("p")!.uses_count).toBe(1);
  });

  it("with room for three, three of six concurrent claimers win (and none exceed the limit)", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 0, max_uses: 3 }]);
    const results = await Promise.all(Array.from({ length: 6 }, () => claimPromoUse(db, "p", 8)));
    const won = results.filter((r) => r === "claimed").length;
    expect(won).toBeLessThanOrEqual(3);
    expect(table.get("p")!.uses_count).toBe(won);
    expect(table.get("p")!.uses_count).toBeLessThanOrEqual(3);
  });
});

describe("releasePromoUse", () => {
  it("gives a claimed use back", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 3, max_uses: 5 }]);
    await releasePromoUse(db, "p");
    expect(table.get("p")!.uses_count).toBe(2);
  });
  it("never goes below zero", async () => {
    const { db, table } = fakeDb([{ id: "p", uses_count: 0, max_uses: 5 }]);
    await releasePromoUse(db, "p");
    expect(table.get("p")!.uses_count).toBe(0);
  });
  it("a code that cannot be read is left alone", async () => {
    const { db, table, log } = fakeDb([{ id: "p", uses_count: 3, max_uses: 5 }], { failSelect: true });
    await releasePromoUse(db, "p");
    expect(table.get("p")!.uses_count).toBe(3);
    expect(log.updates).toBe(0);
  });
});

describe("checkout-event-tickets wiring", () => {
  const src = readFileSync(resolve(__dirname, "../../../supabase/functions/checkout-event-tickets/index.ts"), "utf8");
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it("validates the quantity through the shared helper, before any lookup", () => {
    expect(src).toContain('from "../_shared/ticketCheckout.ts"');
    expect(src).not.toMatch(/quantity < 1 \|\| quantity > 50/);
    expect(at("cleanQuantity(rawQuantity)")).toBeLessThan(at('.from("creative_jams")'));
  });

  it("takes the free grant's promo use atomically, before the capacity reservation", () => {
    expect(at("claimPromoUse(admin, promoId)")).toBeLessThan(at('rpc("reserve_event_ticket_capacity"'));
    expect(src).toContain('claim !== "claimed"');
  });

  it("does not increment the promo use a second time after the grant", () => {
    expect(src).not.toContain("increment_promo_use");
  });

  it("gives the claimed use back when the capacity reservation fails or is refused", () => {
    const reserve = at('rpc("reserve_event_ticket_capacity"');
    const tail = src.slice(reserve);
    expect(tail.match(/releasePromoUse\(admin, promoId\)/g)?.length).toBe(2);
  });

  it("holds a limited code for other buyers' pending orders, not the buyer's own", () => {
    expect(src).toContain("PENDING_ORDER_HOLD_MINUTES");
    expect(src).toContain('.eq("status", "pending")');
    expect(src).toContain('.neq("buyer_id", user.id)');
    expect(src).toContain("promoHasRoom(");
  });

  it("leaves the payment mechanics as they were", () => {
    expect(src).toContain("application_fee_amount: applicationFee");
    expect(src).toContain("transfer_data: { destination: host.stripe_account_id }");
    expect(src).toContain("idempotencyKey: `event-ticket-checkout-${order.id}`");
    expect(src).toContain("const totalCents = Math.round(total * 100);");
  });
});
