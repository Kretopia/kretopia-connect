import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, type RecordedWrite, type Resolver } from "./fakeSupabase";

// Runs the real stripe-marketplace-webhook handler. What matters here is what
// it WRITES for a settled milestone payment, and to whom.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  resolver: null as null | Resolver,
  writes: [] as RecordedWrite[],
  transfers: [] as unknown[],
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("npm:@supabase/supabase-js@2.57.2", () => ({
  createClient: () => {
    const client: any = (globalThis as any).__makeFake(world.resolver, world.writes);
    client.auth = { admin: { getUserById: async () => ({ data: { user: { email: "creative@example.com" } } }) } };
    return client;
  },
}));
vi.mock("https://esm.sh/stripe@18.5.0", () => {
  class FakeStripe {
    static createSubtleCryptoProvider() { return {}; }
    webhooks = { constructEventAsync: async (body: string) => JSON.parse(body) };
    paymentIntents = { retrieve: async () => ({ status: "requires_capture" }) };
    transfers = { create: async (...a: unknown[]) => { world.transfers.push(a); return { id: "tr_1" }; } };
    charges = { retrieve: async () => ({ payment_intent: "pi_1" }) };
  }
  return { default: FakeStripe };
});

const BRAND = "brand";
const baseMilestone = { id: "m1", title: "Logo", project_id: "p1", created_by: BRAND, requested_by: null, status: "completed", escrow_status: "none", amount: 100, projects: { id: "p1", title: "Brand film" } };

function run(opts: {
  eventType?: string;
  session?: Record<string, unknown>;
  metadata?: Record<string, string>;
  collaborators?: { user_id: string; role: string }[];
  project?: Record<string, unknown>;
  milestone?: Record<string, unknown>;
  object?: Record<string, unknown>;
}) {
  const milestone = { ...baseMilestone, ...(opts.milestone || {}) };
  const project = { created_by: BRAND, client_user_id: null, ...(opts.project || {}) };
  world.writes = [];
  world.transfers = [];
  world.resolver = ({ table, op }) => {
    if (table === "milestones") return { data: op === "list" ? [milestone] : milestone };
    if (table === "projects") return { data: project };
    if (table === "project_collaborators") return { data: opts.collaborators || [] };
    if (table === "profiles") return { data: { full_name: "Someone" } };
    return { data: op === "list" ? [] : null };
  };
  const event = {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: opts.eventType || "checkout.session.completed",
    livemode: false,
    data: {
      object: opts.object || {
        payment_status: "paid",
        payment_intent: "pi_1",
        metadata: { kind: "milestone", milestoneId: "m1", userId: BRAND, useEscrow: "false", talentRate: "100", platformFee: "5", managerCommission: "0", ...(opts.metadata || {}) },
        ...(opts.session || {}),
      },
    },
  };
  return world.handler!(
    new Request("https://fn.example/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: JSON.stringify(event) }),
  ).then((res) => ({ res, writes: world.writes, transfers: world.transfers }));
}

const writesTo = (writes: RecordedWrite[], table: string, op?: string) => writes.filter((w) => w.table === table && (!op || w.op === op));
const notifiedUsers = (writes: RecordedWrite[]) =>
  writesTo(writes, "notifications").flatMap((w) => (Array.isArray(w.payload) ? w.payload : [w.payload]) as any[]);

beforeAll(async () => {
  (globalThis as any).__makeFake = makeFakeClient;
  (globalThis as any).Deno = { env: { get: (k: string) => ({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_TEST: "sk_test_1", STRIPE_MARKETPLACE_WEBHOOK_SECRET: "whsec_1", SUPABASE_URL: "https://x.supabase.co" } as Record<string, string>)[k] } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../../supabase/functions/stripe-marketplace-webhook/index.ts");
});
beforeEach(() => { world.writes = []; });

describe("stripe-marketplace-webhook: a settled milestone payment", () => {
  it("credits the payee chosen at checkout: paid_to, the invoice and the notice all go to the creative", async () => {
    const { res, writes } = await run({ metadata: { payeeUserId: "c1" } });
    expect(res.status).toBe(200);
    expect((writesTo(writes, "milestones", "update")[0].payload as any).paid_to).toBe("c1");
    const invoice = writesTo(writes, "invoices", "insert")[0].payload as any;
    expect(invoice.issued_to).toBe("c1");
    expect(invoice.issued_by).toBe(BRAND);
    expect(notifiedUsers(writes).map((n) => n.user_id)).toEqual(["c1"]);
  });

  it("an older session (no payee in its metadata) on a project with one creative still credits that creative, never the Brand", async () => {
    const { writes } = await run({ collaborators: [{ user_id: "c1", role: "editor" }] });
    expect((writesTo(writes, "milestones", "update")[0].payload as any).paid_to).toBe("c1");
    expect(notifiedUsers(writes).every((n) => n.user_id !== BRAND)).toBe(true);
  });

  it("no one identifiable: the payment is recorded as paid but credited to nobody", async () => {
    const { res, writes } = await run({ collaborators: [] });
    expect(res.status).toBe(200);
    const update = writesTo(writes, "milestones", "update")[0].payload as any;
    expect(update.status).toBe("paid");
    expect(update.paid_to).toBeNull();
    // No invoice from the Brand to itself, and no "Payment received" for the Brand.
    expect(writesTo(writes, "invoices")).toHaveLength(0);
    const notices = notifiedUsers(writes);
    expect(notices).toHaveLength(1);
    expect(notices[0].user_id).toBe(BRAND);
    expect(notices[0].title).toMatch(/creative not identified/);
    expect(notices.some((n) => /Payment received 💰/.test(n.title))).toBe(false);
  });

  it("two creatives and no recorded choice: same, nobody is credited on a guess", async () => {
    const { writes } = await run({ collaborators: [{ user_id: "c1", role: "editor" }, { user_id: "c2", role: "designer" }] });
    expect((writesTo(writes, "milestones", "update")[0].payload as any).paid_to).toBeNull();
    expect(writesTo(writes, "invoices")).toHaveLength(0);
  });

  it("holds the manager commission when no payee is identified: nothing filed, nothing transferred", async () => {
    const { writes, transfers } = await run({
      collaborators: [],
      metadata: { managerCommission: "10", managerTableId: "mgr1", managerStripeAccountId: "acct_1" },
    });
    expect(writesTo(writes, "referral_commissions")).toHaveLength(0);
    expect(transfers).toHaveLength(0);
  });

  it("files the manager commission under the payee when there is one", async () => {
    const { writes, transfers } = await run({
      metadata: { payeeUserId: "c1", managerCommission: "10", managerTableId: "mgr1", managerStripeAccountId: "acct_1" },
    });
    expect((writesTo(writes, "referral_commissions", "insert")[0].payload as any).talent_user_id).toBe("c1");
    expect(transfers).toHaveLength(1);
  });

  it("a creative-run Studio paid by its client credits the owner", async () => {
    const { writes } = await run({
      milestone: { created_by: "owner-creative" },
      project: { created_by: "owner-creative", client_user_id: BRAND },
      collaborators: [{ user_id: "h1", role: "editor" }, { user_id: "h2", role: "editor" }],
    });
    expect((writesTo(writes, "milestones", "update")[0].payload as any).paid_to).toBe("owner-creative");
  });
});

describe("stripe-marketplace-webhook: escrow funded and alerts", () => {
  it("escrow funded with no payee identified: only the payer is notified, nobody is told 'funds held for you'", async () => {
    const { res, writes } = await run({
      collaborators: [],
      metadata: { useEscrow: "true" },
    });
    expect(res.status).toBe(200);
    const notices = notifiedUsers(writes);
    expect(notices.map((n) => n.user_id)).toEqual([BRAND]);
    expect(notices[0].title).toMatch(/Payment authorized/);
  });

  it("escrow funded with a chosen payee: the payee and the payer are each told", async () => {
    const { writes } = await run({ metadata: { useEscrow: "true", payeeUserId: "c1" } });
    expect(notifiedUsers(writes).map((n) => n.user_id).sort()).toEqual([BRAND, "c1"]);
  });

  it("a refund alert still reaches someone when the payee is unknown: the milestone's creator", async () => {
    const { writes } = await run({
      eventType: "charge.refunded",
      object: { id: "ch_1", payment_intent: "pi_1" },
      collaborators: [],
    });
    const notices = notifiedUsers(writes);
    expect(notices).toHaveLength(1);
    expect(notices[0].user_id).toBe(BRAND);
    expect(notices[0].title).toMatch(/Refund issued/);
  });
});
