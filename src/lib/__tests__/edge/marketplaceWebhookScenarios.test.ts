import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Sandbox scenarios for the signed-webhook leg of the Stripe loop, run against the REAL stripe-marketplace-webhook
// handler with a fake Stripe (signature check) and an in-memory database. No network, no real key, no real funds.
// Scenarios: success, decline, cancellation, duplicate event, delayed payment, retry after a failed write,
// refund / dispute, and the unauthorized deliveries (no signature, bad signature, a test event on a live deployment).
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as unknown as import("./memoryDb").MemoryDb,
  mode: "test" as "test" | "live",
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: (r: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("npm:@supabase/supabase-js@2.57.2", () => ({ createClient: () => ({ from: (t: string) => world.db.from(t), auth: { admin: { getUserById: async () => ({ data: { user: { email: "x@example.com" } } }) } } }) }));
vi.mock("https://esm.sh/stripe@18.5.0", () => {
  class FakeStripe {
    static createSubtleCryptoProvider() { return {}; }
    webhooks = {
      // Stands in for Stripe's HMAC check: only the signature "valid" verifies.
      constructEventAsync: async (body: string, sig: string) => {
        if (sig !== "valid") throw new Error("No signatures found matching the expected signature for payload");
        return JSON.parse(body);
      },
    };
    paymentIntents = { retrieve: async () => ({ status: "requires_capture" }) };
    charges = { retrieve: async () => ({ payment_intent: "pi_paid" }) };
    transfers = { create: async () => ({ id: "tr_1" }) };
  }
  return { default: FakeStripe };
});

const ENV = (): Record<string, string> =>
  world.mode === "test"
    ? { STRIPE_MODE: "test", STRIPE_SECRET_KEY_TEST: "sk_test_1", STRIPE_MARKETPLACE_WEBHOOK_SECRET: "whsec_1", SUPABASE_URL: "https://x.supabase.co" }
    : { STRIPE_MODE: "live", STRIPE_SECRET_KEY_LIVE: "sk_live_1", STRIPE_MARKETPLACE_WEBHOOK_SECRET: "whsec_1", SUPABASE_URL: "https://x.supabase.co" };

let seq = 0;
const evt = (type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: `evt_${++seq}`,
  type,
  livemode: false,
  data: { object },
  ...extra,
});
const deliver = (event: unknown, headers: Record<string, string> = { "stripe-signature": "valid" }) =>
  world.handler!(new Request("https://fn.example/webhook", { method: "POST", headers, body: JSON.stringify(event) }));

const invoiceSession = (over: Record<string, unknown> = {}) => ({
  id: "cs_inv",
  payment_status: "paid",
  payment_intent: "pi_inv",
  metadata: { kind: "invoice", invoice_id: "inv1", recipient_user_id: "creator" },
  ...over,
});
const seedInvoice = () => world.db.seed("invoices", [{ id: "inv1", status: "sent", stripe_payment_intent_id: null }]);

beforeAll(async () => {
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV()[k] } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../../supabase/functions/stripe-marketplace-webhook/index.ts");
});
beforeEach(() => {
  world.db = new MemoryDb();
  // stripe_webhook_events.event_id is the table's primary key: a second insert of the same id is a 23505.
  world.db.hooks.beforeInsert = (table: string, rows: Array<Record<string, unknown>>, db: MemoryDb) =>
    table === "stripe_webhook_events" && db.rows(table).some((r) => r.event_id === rows[0].event_id)
      ? { message: "duplicate key value violates unique constraint", code: "23505" }
      : undefined;
  world.mode = "test";
});

describe("success: a signed, paid invoice session", () => {
  it("marks the invoice paid with Stripe's payment reference and tells the recipient, once", async () => {
    seedInvoice();
    const res = await deliver(evt("checkout.session.completed", invoiceSession()));
    expect(res.status).toBe(200);
    expect(world.db.rows("invoices")[0]).toMatchObject({ status: "paid", stripe_payment_intent_id: "pi_inv" });
    expect(world.db.rows("notifications")).toHaveLength(1);
    expect(world.db.rows("stripe_webhook_events")).toHaveLength(1);
  });
});

describe("delayed payment: the session completed but the money has not arrived", () => {
  it("records nothing while Stripe says unpaid: no paid invoice, no notice", async () => {
    seedInvoice();
    const res = await deliver(evt("checkout.session.completed", invoiceSession({ payment_status: "unpaid" })));
    expect(res.status).toBe(200);
    expect(world.db.rows("invoices")[0].status).toBe("sent");
    expect(world.db.rows("invoices")[0].stripe_payment_intent_id).toBeNull();
    expect(world.db.rows("notifications")).toHaveLength(0);
  });
});

describe("duplicate and retried events", () => {
  it("the same event delivered twice records the payment once", async () => {
    seedInvoice();
    const e = evt("checkout.session.completed", invoiceSession());
    expect((await deliver(e)).status).toBe(200);
    const second = await deliver(e);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ idempotent_event: true });
    expect(world.db.writes("invoices", "update")).toHaveLength(1);
    expect(world.db.rows("notifications")).toHaveLength(1);
  });

  it("a payment that could not be written answers 500 and gives the event back, so Stripe's retry is processed (not dropped as seen)", async () => {
    seedInvoice();
    let failOnce = true;
    world.db.hooks.failOn = (table, op) => (table === "invoices" && op === "update" && failOnce ? ((failOnce = false), { message: "db down" }) : null);
    const e = evt("checkout.session.completed", invoiceSession());
    expect((await deliver(e)).status).toBe(500);
    expect(world.db.rows("stripe_webhook_events")).toHaveLength(0);

    expect((await deliver(e)).status).toBe(200);
    expect(world.db.rows("invoices")[0]).toMatchObject({ status: "paid", stripe_payment_intent_id: "pi_inv" });
  });
});

describe("decline and cancellation", () => {
  it("a declined payment writes no payment state", async () => {
    seedInvoice();
    const res = await deliver(evt("payment_intent.payment_failed", { id: "pi_x", metadata: { milestoneId: "m1" }, last_payment_error: { message: "Your card was declined." } }));
    expect(res.status).toBe(200);
    expect(world.db.rows("invoices")[0].status).toBe("sent");
    expect(world.db.writes("milestones")).toHaveLength(0);
    expect(world.db.rows("notifications")).toHaveLength(0);
  });

  it("an expired or cancelled escrow hold moves an authorized milestone to cancelled and alerts, nothing else", async () => {
    world.db.seed("milestones", [{ id: "m1", title: "Logo", project_id: "p1", created_by: "brand", requested_by: null, status: "completed", escrow_status: "authorized", payment_intent_id: "pi_e" }]);
    const res = await deliver(evt("payment_intent.canceled", { id: "pi_e", metadata: { milestoneId: "m1", userId: "brand" } }));
    expect(res.status).toBe(200);
    expect(world.db.rows("milestones")[0].escrow_status).toBe("cancelled");
    expect(world.db.rows("notifications")).toHaveLength(1);
  });

  it("out of order: a cancellation arriving after the funds were captured changes nothing", async () => {
    world.db.seed("milestones", [{ id: "m1", title: "Logo", project_id: "p1", created_by: "brand", status: "paid", escrow_status: "captured", payment_intent_id: "pi_e" }]);
    await deliver(evt("payment_intent.canceled", { id: "pi_e", metadata: { milestoneId: "m1" } }));
    expect(world.db.rows("milestones")[0].escrow_status).toBe("captured");
    expect(world.db.rows("notifications")).toHaveLength(0);
  });
});

describe("refund and dispute: alert a person, never rewrite the project", () => {
  const seedPaid = () => {
    world.db.seed("milestones", [{ id: "m1", title: "Logo", project_id: "p1", created_by: "brand", requested_by: null, status: "paid", escrow_status: "none", payment_intent_id: "pi_paid", paid_to: "creator" }]);
    world.db.seed("projects", [{ id: "p1", status: "completed", created_by: "brand" }]);
  };

  it("a refund leaves the milestone and the project status as they are and raises a review notice", async () => {
    seedPaid();
    const res = await deliver(evt("charge.refunded", { id: "ch_1", payment_intent: "pi_paid" }));
    expect(res.status).toBe(200);
    expect(world.db.rows("milestones")[0]).toMatchObject({ status: "paid", escrow_status: "none" });
    expect(world.db.rows("projects")[0].status).toBe("completed");
    expect(world.db.rows("notifications")).toHaveLength(1);
    expect(world.db.rows("notifications")[0]).toMatchObject({ type: "alert", priority: "high" });
  });

  it("a dispute does the same", async () => {
    seedPaid();
    const res = await deliver(evt("charge.dispute.created", { id: "dp_1", charge: "ch_1" }));
    expect(res.status).toBe(200);
    expect(world.db.rows("milestones")[0].status).toBe("paid");
    expect(world.db.rows("projects")[0].status).toBe("completed");
    expect(world.db.rows("notifications")).toHaveLength(1);
  });
});

describe("unauthorized deliveries never reach the database", () => {
  it("no signature header: 400, nothing written", async () => {
    seedInvoice();
    const res = await deliver(evt("checkout.session.completed", invoiceSession()), {});
    expect(res.status).toBe(400);
    expect(world.db.log).toHaveLength(0);
    expect(world.db.rows("invoices")[0].status).toBe("sent");
  });

  it("a forged signature: 400, nothing written", async () => {
    seedInvoice();
    const res = await deliver(evt("checkout.session.completed", invoiceSession()), { "stripe-signature": "forged" });
    expect(res.status).toBe(400);
    expect(world.db.log).toHaveLength(0);
    expect(world.db.rows("invoices")[0].status).toBe("sent");
  });

  it("a test-mode event on a live deployment is refused, even with a valid signature", async () => {
    world.mode = "live";
    seedInvoice();
    const res = await deliver(evt("checkout.session.completed", invoiceSession(), { livemode: false }));
    expect(res.status).toBe(400);
    expect(world.db.log).toHaveLength(0);
    expect(world.db.rows("invoices")[0].status).toBe("sent");
  });

  it("a live event on a live deployment is accepted", async () => {
    world.mode = "live";
    seedInvoice();
    const res = await deliver(evt("checkout.session.completed", invoiceSession(), { livemode: true }));
    expect(res.status).toBe(200);
    expect(world.db.rows("invoices")[0].status).toBe("paid");
  });
});
