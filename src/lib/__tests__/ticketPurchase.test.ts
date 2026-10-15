import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_SESSIONS_TO_CHECK,
  STARTING_PURCHASE_SECONDS,
  classifyTicketSession,
  planFromPriorOrders,
} from "../../../supabase/functions/_shared/ticketPurchase";

const now = new Date("2026-10-15T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();
const order = (o: Partial<{ id: string; status: string; stripe_session_id: string | null; created_at: string }>) => ({
  id: "o1",
  status: "pending",
  stripe_session_id: null,
  created_at: ago(3600),
  ...o,
});

describe("planFromPriorOrders", () => {
  it("a buyer with no earlier order has nothing in the way", () => {
    expect(planFromPriorOrders([], now)).toEqual({ paid: false, startingNow: false, sessionsToCheck: [] });
    expect(planFromPriorOrders(null, now)).toEqual({ paid: false, startingNow: false, sessionsToCheck: [] });
    expect(planFromPriorOrders(undefined, now)).toEqual({ paid: false, startingNow: false, sessionsToCheck: [] });
  });

  it("a paid order is reported, whatever else is there", () => {
    const plan = planFromPriorOrders([order({ status: "pending", stripe_session_id: "cs_1" }), order({ id: "o2", status: "paid" })], now);
    expect(plan.paid).toBe(true);
  });

  it("a purchase created seconds ago with no session yet is 'starting now'", () => {
    expect(planFromPriorOrders([order({ created_at: ago(5) })], now).startingNow).toBe(true);
    expect(planFromPriorOrders([order({ created_at: ago(STARTING_PURCHASE_SECONDS - 1) })], now).startingNow).toBe(true);
  });

  it("an old order that never got a session is ignored", () => {
    const plan = planFromPriorOrders([order({ created_at: ago(STARTING_PURCHASE_SECONDS + 1) })], now);
    expect(plan).toEqual({ paid: false, startingNow: false, sessionsToCheck: [] });
  });

  it("an unreadable date refuses rather than guesses", () => {
    expect(planFromPriorOrders([order({ created_at: "not a date" })], now).startingNow).toBe(true);
  });

  it("earlier sessions are listed newest first and bounded", () => {
    const orders = Array.from({ length: 6 }, (_, i) =>
      order({ id: `o${i}`, stripe_session_id: `cs_${i}`, created_at: ago(1000 + i * 100) }),
    );
    const plan = planFromPriorOrders(orders, now);
    expect(plan.sessionsToCheck).toHaveLength(MAX_SESSIONS_TO_CHECK);
    expect(plan.sessionsToCheck.map((s) => s.sessionId)).toEqual(["cs_0", "cs_1", "cs_2"]);
  });

  it("cancelled or other statuses are not part of the plan", () => {
    const plan = planFromPriorOrders(
      [order({ status: "cancelled", stripe_session_id: "cs_x" }), order({ id: "o2", status: "refunded" })],
      now,
    );
    expect(plan).toEqual({ paid: false, startingNow: false, sessionsToCheck: [] });
  });
});

describe("classifyTicketSession", () => {
  const expected = { amountCents: 2500, currency: "usd" };
  const open = { status: "open", url: "https://checkout.stripe.com/c/pay/cs_1", amount_total: 2500, currency: "usd" };

  it("a completed session means the buyer has paid or is paying: no second purchase", () => {
    expect(classifyTicketSession({ status: "complete", amount_total: 2500, currency: "usd" }, expected)).toBe("paid");
    expect(classifyTicketSession({ status: "complete", amount_total: 9999, currency: "eur" }, expected)).toBe("paid");
  });

  it("an open session at the same price is handed back", () => {
    expect(classifyTicketSession(open, expected)).toBe("reuse");
    expect(classifyTicketSession({ ...open, currency: "USD" }, expected)).toBe("reuse");
  });

  it("an open session at another price, in another currency, or without a URL is replaced", () => {
    expect(classifyTicketSession({ ...open, amount_total: 1000 }, expected)).toBe("recreate");
    expect(classifyTicketSession({ ...open, currency: "eur" }, expected)).toBe("recreate");
    expect(classifyTicketSession({ ...open, url: null }, expected)).toBe("recreate");
    expect(classifyTicketSession({ ...open, url: "" }, expected)).toBe("recreate");
    expect(classifyTicketSession({ ...open, amount_total: null }, expected)).toBe("recreate");
  });

  it("an expired or missing session is replaced", () => {
    expect(classifyTicketSession({ status: "expired" }, expected)).toBe("recreate");
    expect(classifyTicketSession(null, expected)).toBe("recreate");
    expect(classifyTicketSession(undefined, expected)).toBe("recreate");
  });

  it("a state it does not know refuses", () => {
    for (const status of ["", "weird", null, undefined, "paid"]) {
      expect(classifyTicketSession({ status }, expected)).toBe("unknown");
    }
  });
});

describe("purchase-event-ticket wiring", () => {
  const src = readFileSync(resolve(__dirname, "../../../supabase/functions/purchase-event-ticket/index.ts"), "utf8");
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it("imports the shared plan and classifier", () => {
    expect(src).toContain('from "../_shared/ticketPurchase.ts"');
  });

  it("refuses a missing Authorization header instead of crashing on it", () => {
    expect(src).not.toContain('get("Authorization")!');
    expect(at('if (!authHeader) throw new Error("User not authenticated")')).toBeLessThan(at("auth.getUser(token)"));
  });

  it("refuses a cancelled event before anything is created", () => {
    expect(src).toContain("event.status === 'cancelled'");
    expect(at("event.status === 'cancelled'")).toBeLessThan(at("stripe.customers.list"));
  });

  it("looks at the buyer's earlier orders before it creates an order or a session", () => {
    const plan = at("planFromPriorOrders(");
    expect(plan).toBeLessThan(at("tier_id: null,"));
    expect(plan).toBeLessThan(at("checkout.sessions.create("));
    expect(src).toContain("if (priorErr) throw");
    expect(src).toContain("plan.paid");
    expect(src).toContain("plan.startingNow");
  });

  it("an earlier open session of the same price is returned, any other open one is expired first", () => {
    expect(src).toContain("action === 'reuse'");
    expect(src).toContain("checkout.sessions.expire(prior.sessionId)");
    expect(src).toContain("action === 'unknown'");
    expect(at("checkout.sessions.expire(")).toBeLessThan(at("checkout.sessions.create("));
  });

  it("leaves the price, fee, destination and quantity as they were", () => {
    expect(src).toContain("unit_amount: priceInCents");
    expect(src).toContain("application_fee_amount: applicationFee");
    expect(src).toContain("destination: hostProfile.stripe_account_id");
    expect(src).toContain("quantity: 1,");
    expect(src).toContain("const priceInCents = Math.round(event.ticket_price * 100);");
  });
});
