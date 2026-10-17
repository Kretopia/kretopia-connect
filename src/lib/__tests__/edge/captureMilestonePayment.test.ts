import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, type RecordedWrite, type Resolver } from "./fakeSupabase";

// Runs the real capture-milestone-payment handler (releasing a held escrow).
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  resolver: null as null | Resolver,
  writes: [] as RecordedWrite[],
  intentMetadata: {} as Record<string, string>,
  capture: null as null | ((...a: any[]) => any),
  cancel: null as null | ((...a: any[]) => any),
  user: null as null | { id: string; email: string },
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => {
    const client: any = (globalThis as any).__makeFake(world.resolver, world.writes);
    client.auth = {
      getUser: async () => ({ data: { user: world.user } }),
      admin: { getUserById: async () => ({ data: { user: { email: "creative@example.com" } } }) },
    };
    return client;
  },
}));
vi.mock("https://esm.sh/stripe@18.5.0", () => ({
  default: class {
    paymentIntents = {
      retrieve: async () => ({ metadata: world.intentMetadata, status: "requires_capture" }),
      capture: (...a: any[]) => world.capture!(...a),
      cancel: (...a: any[]) => world.cancel!(...a),
    };
    transfers = { create: async () => ({ id: "tr_1" }) };
  },
}));

const BRAND = "brand";
const baseMilestone = { id: "m1", title: "Logo", project_id: "p1", created_by: BRAND, requested_by: null, status: "review", escrow_status: "authorized", payment_intent_id: "pi_1", amount: 100, projects: { id: "p1", title: "Brand film", created_by: BRAND, client_user_id: null } };

async function run(opts: { action?: "capture" | "cancel"; metadata?: Record<string, string>; collaborators?: { user_id: string; role: string }[]; auth?: "none" | "invalid" }) {
  world.writes = [];
  world.user = opts.auth === "invalid" ? null : { id: BRAND, email: "brand@example.com" };
  world.intentMetadata = { userId: BRAND, talentRate: "100", platformFee: "5", managerCommission: "0", ...(opts.metadata || {}) };
  world.capture = vi.fn(async () => ({ status: "succeeded" }));
  world.cancel = vi.fn(async () => ({ status: "canceled" }));
  world.resolver = ({ table, op }) => {
    if (table === "milestones") return { data: op === "list" ? [baseMilestone] : baseMilestone };
    if (table === "projects") return { data: { id: "p1", created_by: BRAND, client_user_id: null } };
    if (table === "project_collaborators") return { data: opts.collaborators || [] };
    if (table === "profiles") return { data: { full_name: "Someone" } };
    return { data: op === "list" ? [] : null };
  };
  const res = await world.handler!(
    new Request("https://fn.example/capture", {
      method: "POST",
      headers: opts.auth === "none" ? {} : { Authorization: "Bearer t" },
      body: JSON.stringify({ milestoneId: "m1", paymentIntentId: "pi_1", action: opts.action || "capture" }),
    }),
  );
  return { res, writes: world.writes, capture: world.capture as any, cancel: world.cancel as any };
}
const writesTo = (w: RecordedWrite[], table: string, op?: string) => w.filter((x) => x.table === table && (!op || x.op === op));
const notified = (w: RecordedWrite[]) => writesTo(w, "notifications").flatMap((x) => (Array.isArray(x.payload) ? x.payload : [x.payload]) as any[]);

beforeAll(async () => {
  (globalThis as any).__makeFake = makeFakeClient;
  (globalThis as any).Deno = { env: { get: (k: string) => ({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_TEST: "sk_test_1", SUPABASE_URL: "https://x.supabase.co" } as Record<string, string>)[k] } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../../supabase/functions/capture-milestone-payment/index.ts");
});
beforeEach(() => { world.writes = []; });

describe("capture-milestone-payment: releasing a held escrow", () => {
  it("credits the payee recorded at checkout in the PaymentIntent", async () => {
    const { res, writes, capture } = await run({ metadata: { payeeUserId: "c1" } });
    expect(res.status).toBe(200);
    expect(capture).toHaveBeenCalledTimes(1);
    expect((writesTo(writes, "milestones", "update")[0].payload as any).paid_to).toBe("c1");
    expect((writesTo(writes, "invoices", "insert")[0].payload as any).issued_to).toBe("c1");
    expect(notified(writes).map((n) => n.user_id).sort()).toEqual([BRAND, "c1"]);
  });

  it("an escrow funded before payees were recorded still resolves a lone creative, never the Brand", async () => {
    const { writes } = await run({ collaborators: [{ user_id: "c1", role: "editor" }] });
    expect((writesTo(writes, "milestones", "update")[0].payload as any).paid_to).toBe("c1");
    expect((writesTo(writes, "invoices", "insert")[0].payload as any).issued_to).toBe("c1");
  });

  it("no payee identified: the money IS captured (the hold must not lapse), but nobody is credited", async () => {
    const { res, writes, capture } = await run({ collaborators: [] });
    expect(res.status).toBe(200);
    expect(capture).toHaveBeenCalledTimes(1);
    const update = writesTo(writes, "milestones", "update")[0].payload as any;
    expect(update.status).toBe("paid");
    expect(update.paid_to).toBeNull();
    expect(writesTo(writes, "invoices")).toHaveLength(0);
    expect(writesTo(writes, "referral_commissions")).toHaveLength(0);
    const notices = notified(writes);
    expect(notices.every((n) => n.user_id === BRAND)).toBe(true);
    expect(notices.some((n) => /creative not identified/.test(n.title))).toBe(true);
    expect(notices.some((n) => /released to you/.test(n.message))).toBe(false);
  });

  it("holds a manager commission when no payee is identified", async () => {
    const { writes } = await run({ collaborators: [], metadata: { managerCommission: "10", managerTableId: "mgr1", managerStripeAccountId: "acct_1" } });
    expect(writesTo(writes, "referral_commissions")).toHaveLength(0);
    expect(writesTo(writes, "milestone_commission_transfers")).toHaveLength(0);
  });

  it("files the commission under the payee when there is one", async () => {
    const { writes } = await run({ metadata: { payeeUserId: "c1", managerCommission: "10", managerTableId: "mgr1", managerStripeAccountId: "acct_1" } });
    expect((writesTo(writes, "referral_commissions", "insert")[0].payload as any).talent_user_id).toBe("c1");
  });

  it("cancelling tells the payee when known, and nobody when not (it does not guess)", async () => {
    const known = await run({ action: "cancel", metadata: { payeeUserId: "c1" } });
    expect(known.cancel).toHaveBeenCalledTimes(1);
    expect(notified(known.writes).map((n) => n.user_id)).toEqual(["c1"]);
    expect((writesTo(known.writes, "milestones", "update")[0].payload as any).paid_to).toBeNull();

    const unknown = await run({ action: "cancel", collaborators: [] });
    expect(writesTo(unknown.writes, "notifications")).toHaveLength(0);
  });

  it("answers 401, not 500, when the request has no connection", async () => {
    const { res, writes, capture, cancel } = await run({ auth: "none" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "User not authenticated" });
    expect(capture).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("answers 401, not 500, when the connection does not resolve to a user", async () => {
    for (const action of ["capture", "cancel"] as const) {
      const { res, writes, capture, cancel } = await run({ auth: "invalid", action });
      expect(res.status).toBe(401);
      expect(capture).not.toHaveBeenCalled();
      expect(cancel).not.toHaveBeenCalled();
      expect(writes).toHaveLength(0);
    }
  });

  it("still refuses anyone who is not the recorded payer, before touching Stripe", async () => {
    const { res, capture } = await run({ metadata: { userId: "someone-else" } });
    expect(res.status).toBe(403);
    expect(capture).not.toHaveBeenCalled();
  });
});
