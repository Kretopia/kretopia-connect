import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, type RecordedWrite, type Resolver } from "./fakeSupabase";

// Runs the real create-milestone-payment handler against a fake database and a
// fake Stripe, so what is asserted is what the function would actually send.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  resolver: null as null | Resolver,
  writes: [] as unknown[],
  stripeCreate: null as null | ((...a: any[]) => any),
  referralLookups: [] as unknown[],
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => {
    const client: any = world.resolver ? (globalThis as any).__makeFake(world.resolver, world.writes) : {};
    client.auth = { getUser: async () => ({ data: { user: { id: "brand", email: "brand@example.com" } } }) };
    return client;
  },
}));
vi.mock("https://esm.sh/stripe@18.5.0", () => ({
  default: class {
    customers = { list: async () => ({ data: [] }) };
    checkout = { sessions: { create: (...a: any[]) => world.stripeCreate!(...a) } };
  },
}));

const BRAND = "brand";
const baseMilestone = { created_by: BRAND, requested_by: null, status: "completed", amount: 100, project_id: "p1", title: "Logo", escrow_status: "none", paid_at: null };

function scenario(opts: {
  milestone?: Record<string, unknown>;
  project?: Record<string, unknown>;
  collaborators?: { user_id: string; role: string }[];
  body?: Record<string, unknown>;
}) {
  const milestone = { ...baseMilestone, ...(opts.milestone || {}) };
  const project = { created_by: BRAND, client_user_id: null, ...(opts.project || {}) };
  const names: Record<string, string> = { c1: "Ada Lovelace", c2: "Grace Hopper" };
  world.writes = [];
  world.referralLookups = [];
  world.resolver = ({ table, op, filters, inFilters }) => {
    if (table === "profiles" && inFilters.user_id) {
      return { data: (inFilters.user_id as string[]).map((id) => ({ user_id: id, full_name: names[id] ?? null, avatar_url: null })) };
    }
    if (table === "profiles") return { data: { subscription_tier: "free" } };
    if (table === "milestones") return { data: milestone };
    if (table === "projects") return { data: project };
    if (table === "project_collaborators") return { data: opts.collaborators || [] };
    if (table === "talent_referrals") { world.referralLookups.push(filters); return { data: null }; }
    return { data: op === "list" ? [] : null };
  };
  const create = vi.fn(async () => ({ id: "cs_1", url: "https://checkout.example/cs_1" }));
  world.stripeCreate = create;
  const call = async () => {
    const res = await world.handler!(
      new Request("https://fn.example/create-milestone-payment", {
        method: "POST",
        headers: { Authorization: "Bearer t", origin: "https://app.example" },
        body: JSON.stringify({ milestoneId: "m1", useEscrow: false, ...(opts.body || {}) }),
      }),
    );
    return { res, json: await res.json(), create };
  };
  return call();
}

beforeAll(async () => {
  (globalThis as any).__makeFake = makeFakeClient;
  (globalThis as any).Deno = { env: { get: (k: string) => ({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_TEST: "sk_test_123", SUPABASE_URL: "https://x.supabase.co" } as Record<string, string>)[k] } };
  await import("../../../../supabase/functions/create-milestone-payment/index.ts");
});
beforeEach(() => { world.resolver = null; });

describe("create-milestone-payment: who the payment is for", () => {
  it("a Brand-created milestone with one creative: sessions carry that creative, never the Brand", async () => {
    const { res, create } = await scenario({ collaborators: [{ user_id: "c1", role: "editor" }] });
    expect(res.status).toBe(200);
    const [params, options] = create.mock.calls[0] as any[];
    expect(params.metadata.payeeUserId).toBe("c1");
    expect(params.metadata.userId).toBe(BRAND);
    expect(options.idempotencyKey).toContain(":c1:");
    expect((world.referralLookups[0] as any).talent_user_id).toBe("c1");
  });

  it("escrow: the held PaymentIntent carries the payee too, so the release credits the same person", async () => {
    const { create } = await scenario({ body: { useEscrow: true }, collaborators: [{ user_id: "c1", role: "editor" }] });
    const [params] = create.mock.calls[0] as any[];
    expect(params.payment_intent_data.capture_method).toBe("manual");
    expect(params.payment_intent_data.metadata.payeeUserId).toBe("c1");
  });

  it("several creatives and no choice: refuses with the list, and Stripe is never called", async () => {
    const { res, json, create } = await scenario({ collaborators: [{ user_id: "c1", role: "editor" }, { user_id: "c2", role: "designer" }] });
    expect(res.status).toBe(409);
    expect(json.code).toBe("PAYEE_UNCLEAR");
    expect(json.candidates.map((c: any) => c.full_name).sort()).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(create).not.toHaveBeenCalled();
  });

  it("several creatives and a valid pick: charges, crediting the one picked", async () => {
    const { res, create } = await scenario({
      collaborators: [{ user_id: "c1", role: "editor" }, { user_id: "c2", role: "designer" }],
      body: { payeeUserId: "c2" },
    });
    expect(res.status).toBe(200);
    expect((create.mock.calls[0] as any[])[0].metadata.payeeUserId).toBe("c2");
  });

  it("a forged pick (not on the project) or the payer picking themselves is refused", async () => {
    const collaborators = [{ user_id: "c1", role: "editor" }, { user_id: "c2", role: "designer" }];
    for (const forged of ["someone-else", BRAND]) {
      const { res, json, create } = await scenario({ collaborators, body: { payeeUserId: forged } });
      expect(res.status).toBe(409);
      expect(json.code).toBe("PAYEE_UNCLEAR");
      expect(create).not.toHaveBeenCalled();
    }
  });

  it("no creative on the project: says so instead of charging for nobody", async () => {
    const { res, json, create } = await scenario({ collaborators: [] });
    expect(res.status).toBe(409);
    expect(json.code).toBe("PAYEE_NONE");
    expect(json.error).toMatch(/Add the creative/);
    expect(create).not.toHaveBeenCalled();
  });

  it("a creative who asked to be paid is the payee: the payer cannot redirect it to someone else", async () => {
    const { res, create } = await scenario({
      milestone: { created_by: "c1", requested_by: "c1" },
      collaborators: [{ user_id: "c1", role: "editor" }, { user_id: "c2", role: "designer" }],
      body: { payeeUserId: "c2" },
    });
    expect(res.status).toBe(200);
    expect((create.mock.calls[0] as any[])[0].metadata.payeeUserId).toBe("c1");
  });

  it("a creative-run Studio paid by its client credits the owner, even with helpers on the project", async () => {
    const { res, create } = await scenario({
      milestone: { created_by: "owner-creative" },
      project: { created_by: "owner-creative", client_user_id: BRAND },
      collaborators: [{ user_id: "h1", role: "editor" }, { user_id: "h2", role: "editor" }],
    });
    expect(res.status).toBe(200);
    expect((create.mock.calls[0] as any[])[0].metadata.payeeUserId).toBe("owner-creative");
  });

  it("a different payee is a different Stripe request (the idempotency key changes)", async () => {
    const collaborators = [{ user_id: "c1", role: "editor" }, { user_id: "c2", role: "designer" }];
    const a = await scenario({ collaborators, body: { payeeUserId: "c1" } });
    const b = await scenario({ collaborators, body: { payeeUserId: "c2" } });
    const keyA = (a.create.mock.calls[0] as any[])[1].idempotencyKey;
    const keyB = (b.create.mock.calls[0] as any[])[1].idempotencyKey;
    expect(keyA).not.toBe(keyB);
  });

  it("still refuses a caller who is not the project's payer, before anything else", async () => {
    const { res, create } = await scenario({ project: { created_by: "someone", client_user_id: "someone-else" }, collaborators: [{ user_id: "c1", role: "editor" }] });
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
});
