import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  activateFounderPurchase,
  checkFounderSession,
  FOUNDER_BONUS_XP,
  FOUNDER_PRODUCT_ID,
  recoverPendingFounderPurchase,
  type FounderSession,
} from "../../../supabase/functions/_shared/founderActivation";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

type Row = Record<string, unknown>;

// An in-memory stand-in for the service-role client. Like Postgres, an `update ... where` is evaluated against the
// row as it is when the statement runs, so of two updates guarded by `status <> 'completed'` only the first matches.
function fakeDb(seed: Record<string, Row[]>, opts: { failTierWrites?: number } = {}) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  let ids = 1000;
  let tierFailures = opts.failTierWrites ?? 0;

  const from = (table: string) => {
    const state: { op: string; patch?: Row; row?: Row; returning: boolean; single?: "one" | "maybe"; limit?: number; filters: ((r: Row) => boolean)[] } = {
      op: "select",
      returning: false,
      filters: [],
    };
    const rows = () => (tables[table] ??= []);
    const run = () => {
      if (state.op === "insert") {
        rows().push({ id: `id-${ids++}`, ...state.row });
        return { data: null, error: null };
      }
      const matching = rows().filter((r) => state.filters.every((f) => f(r)));
      if (state.op === "update") {
        if (table === "profiles" && state.patch?.subscription_tier === "founder" && tierFailures > 0) {
          tierFailures -= 1;
          return { data: null, error: { message: "write failed" } };
        }
        matching.forEach((r) => Object.assign(r, state.patch));
        return { data: state.returning ? matching.map((r) => ({ id: r.id })) : null, error: null };
      }
      if (state.op === "delete") {
        tables[table] = rows().filter((r) => !matching.includes(r));
        return { data: null, error: null };
      }
      const data = matching.slice(0, state.limit ?? matching.length);
      if (state.single === "one") return data.length ? { data: data[0], error: null } : { data: null, error: { message: "no rows" } };
      if (state.single === "maybe") return { data: data[0] ?? null, error: null };
      return { data, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => {
        if (state.op === "update" || state.op === "insert") state.returning = true;
        return q;
      },
      update: (patch: Row) => ((state.op = "update"), (state.patch = patch), q),
      insert: (row: Row) => ((state.op = "insert"), (state.row = row), q),
      delete: () => ((state.op = "delete"), q),
      eq: (c: string, v: unknown) => (state.filters.push((r) => r[c] === v), q),
      neq: (c: string, v: unknown) => (state.filters.push((r) => r[c] !== v), q),
      in: (c: string, vs: unknown[]) => (state.filters.push((r) => vs.includes(r[c])), q),
      not: (c: string, op: string, v: unknown) => (op === "is" && v === null && state.filters.push((r) => r[c] != null), q),
      order: () => q,
      limit: (n: number) => ((state.limit = n), q),
      maybeSingle: () => ((state.single = "maybe"), q),
      single: () => ((state.single = "one"), q),
      then: (resolveFn: (v: unknown) => unknown, rejectFn: (e: unknown) => unknown) => Promise.resolve(run()).then(resolveFn, rejectFn),
    };
    return q;
  };
  return { db: { from }, tables };
}

const USER = "user-1";
const paid = (over: Partial<FounderSession> = {}): FounderSession => ({
  id: "cs_1",
  status: "complete",
  payment_status: "paid",
  payment_intent: "pi_1",
  metadata: { type: "founder_circle", user_id: USER },
  ...over,
});
const seedPending = (n = 1) => ({
  founder_circle_purchases: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, user_id: USER, stripe_session_id: "cs_1", status: "pending" })),
  profiles: [{ user_id: USER, subscription_tier: "free", subscription_status: "none", xp: 100 }],
  xp_activities: [],
});

describe("checkFounderSession", () => {
  it("accepts a paid Founder Circle session of the caller", () => {
    expect(checkFounderSession(paid(), USER)).toEqual({ ok: true });
  });

  it("names why a session is refused: not paid, another product, or another person's payment", () => {
    expect(checkFounderSession(paid({ payment_status: "unpaid" }), USER)).toEqual({ ok: false, reason: "not_paid" });
    expect(checkFounderSession(paid({ metadata: { type: "marketplace_purchase", user_id: USER } }), USER)).toEqual({ ok: false, reason: "wrong_type" });
    expect(checkFounderSession(paid({ metadata: null }), USER)).toEqual({ ok: false, reason: "wrong_type" });
    expect(checkFounderSession(paid({ metadata: { type: "founder_circle", user_id: "someone-else" } }), USER)).toEqual({ ok: false, reason: "wrong_user" });
  });
});

describe("activateFounderPurchase", () => {
  it("completes the purchase, makes the buyer a lifetime founder and pays the bonus once", async () => {
    const { db, tables } = fakeDb(seedPending());
    expect(await activateFounderPurchase(db, USER, paid())).toBe("activated");
    expect(tables.founder_circle_purchases[0]).toMatchObject({ status: "completed", stripe_payment_intent_id: "pi_1" });
    expect(tables.profiles[0]).toMatchObject({
      subscription_tier: "founder",
      subscription_status: "active",
      subscription_product_id: FOUNDER_PRODUCT_ID,
      subscription_end_date: null,
      xp: 100 + FOUNDER_BONUS_XP,
    });
    expect(tables.xp_activities).toHaveLength(1);
  });

  it("two verifications of the same session at once activate once and pay the bonus once", async () => {
    const { db, tables } = fakeDb(seedPending());
    const results = await Promise.all([activateFounderPurchase(db, USER, paid()), activateFounderPurchase(db, USER, paid())]);
    expect([...results].sort()).toEqual(["activated", "already_processed"]);
    expect(tables.xp_activities).toHaveLength(1);
    expect(tables.profiles[0].xp).toBe(100 + FOUNDER_BONUS_XP);
  });

  it("a session that is already completed is answered 'already_processed' with no second bonus", async () => {
    const seed = seedPending();
    seed.founder_circle_purchases[0].status = "completed";
    const { db, tables } = fakeDb(seed);
    expect(await activateFounderPurchase(db, USER, paid())).toBe("already_processed");
    expect(tables.xp_activities).toHaveLength(0);
    expect(tables.profiles[0].subscription_tier).toBe("free");
  });

  it("records the purchase when the row written at checkout is missing: Stripe says it is paid", async () => {
    const seed = seedPending();
    seed.founder_circle_purchases = [];
    const { db, tables } = fakeDb(seed);
    expect(await activateFounderPurchase(db, USER, paid())).toBe("activated");
    expect(tables.founder_circle_purchases).toHaveLength(1);
    expect(tables.founder_circle_purchases[0]).toMatchObject({ user_id: USER, stripe_session_id: "cs_1", status: "completed" });
    expect(tables.profiles[0].subscription_tier).toBe("founder");
  });

  it("gives the claim back when the tier cannot be written, so the next attempt finishes the job", async () => {
    const { db, tables } = fakeDb(seedPending(), { failTierWrites: 1 });
    await expect(activateFounderPurchase(db, USER, paid())).rejects.toThrow(/Could not activate the Founder Circle tier/);
    expect(tables.founder_circle_purchases[0].status).toBe("pending");
    expect(tables.xp_activities).toHaveLength(0);

    expect(await activateFounderPurchase(db, USER, paid())).toBe("activated");
    expect(tables.profiles[0].subscription_tier).toBe("founder");
    expect(tables.xp_activities).toHaveLength(1);
  });

  it("keeps one row for a session that checkout inserted twice (the same idempotency key returns the same session)", async () => {
    const { db, tables } = fakeDb(seedPending(2));
    expect(await activateFounderPurchase(db, USER, paid())).toBe("activated");
    expect(tables.founder_circle_purchases).toHaveLength(1);
    expect(tables.founder_circle_purchases[0].status).toBe("completed");
  });
});

describe("recoverPendingFounderPurchase: a buyer who paid and never came back to /payment-success", () => {
  const stripeWith = (session: FounderSession | Error) => ({
    checkout: { sessions: { retrieve: vi.fn(async () => { if (session instanceof Error) throw session; return session; }) } },
  });

  it("activates a pending purchase that Stripe reports as paid", async () => {
    const { db, tables } = fakeDb(seedPending());
    const stripe = stripeWith(paid());
    expect(await recoverPendingFounderPurchase(db, stripe, USER)).toBe(true);
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_1");
    expect(tables.profiles[0].subscription_tier).toBe("founder");
    expect(tables.xp_activities).toHaveLength(1);
  });

  it("leaves a purchase that is not paid yet alone", async () => {
    const { db, tables } = fakeDb(seedPending());
    expect(await recoverPendingFounderPurchase(db, stripeWith(paid({ status: "open", payment_status: "unpaid" })), USER)).toBe(false);
    expect(tables.founder_circle_purchases[0].status).toBe("pending");
    expect(tables.profiles[0].subscription_tier).toBe("free");
  });

  it("closes a purchase whose session expired, so it is not looked up on every later call", async () => {
    const { db, tables } = fakeDb(seedPending());
    expect(await recoverPendingFounderPurchase(db, stripeWith(paid({ status: "expired", payment_status: "unpaid" })), USER)).toBe(false);
    expect(tables.founder_circle_purchases[0].status).toBe("expired");
    expect(tables.profiles[0].subscription_tier).toBe("free");
  });

  it("never grants a tier from another person's payment or from another product", async () => {
    for (const metadata of [{ type: "founder_circle", user_id: "someone-else" }, { type: "marketplace_purchase", user_id: USER }]) {
      const { db, tables } = fakeDb(seedPending());
      expect(await recoverPendingFounderPurchase(db, stripeWith(paid({ metadata })), USER)).toBe(false);
      expect(tables.profiles[0].subscription_tier).toBe("free");
      expect(tables.founder_circle_purchases[0].status).toBe("pending");
    }
  });

  it("does not call Stripe when the user has nothing pending", async () => {
    const seed = seedPending();
    seed.founder_circle_purchases = [];
    const { db } = fakeDb(seed);
    const stripe = stripeWith(paid());
    expect(await recoverPendingFounderPurchase(db, stripe, USER)).toBe(false);
    expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it("never throws: a Stripe or database failure must not break check-subscription", async () => {
    const { db } = fakeDb(seedPending());
    expect(await recoverPendingFounderPurchase(db, stripeWith(new Error("stripe down")), USER)).toBe(false);
    const broken = { from: () => { throw new Error("db down"); } };
    expect(await recoverPendingFounderPurchase(broken, stripeWith(paid()), USER)).toBe(false);
  });
});

describe("the functions use it", () => {
  const verify = read("supabase/functions/verify-founder-payment/index.ts");
  const check = read("supabase/functions/check-subscription/index.ts");

  it("verify-founder-payment claims through the shared activation and has no unconditional completion left", () => {
    expect(verify).toContain("activateFounderPurchase(supabaseAdmin, user.id, session)");
    expect(verify).toContain("checkFounderSession(session, user.id)");
    expect(verify).not.toMatch(/\.update\(\{\s*status: 'completed'/);
    expect(verify).not.toContain("FOUNDER_BONUS_XP = 5000");
  });

  it("verify-founder-payment answers 401, not a crash, when there is no Authorization header", () => {
    expect(verify).not.toContain('get("Authorization")!');
    expect(verify).toMatch(/if \(!authHeader\) \{[\s\S]{0,260}status: 401/);
  });

  it("check-subscription recovers a pending purchase before it looks at subscriptions, and returns the founder tier", () => {
    const recover = check.indexOf("recoverPendingFounderPurchase(supabaseClient, stripe, user.id)");
    const customers = check.indexOf("stripe.customers.list");
    expect(recover).toBeGreaterThan(-1);
    expect(recover).toBeLessThan(customers);
    expect(check).toMatch(/recoverPendingFounderPurchase\([^)]*\)\) \{[\s\S]{0,300}tier: 'founder'/);
  });
});
