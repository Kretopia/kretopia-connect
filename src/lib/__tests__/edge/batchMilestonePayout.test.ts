import { beforeAll, describe, expect, it, vi } from "vitest";
import { makeFakeClient, type RecordedWrite, type Resolver } from "./fakeSupabase";

// Runs the real batch-milestone-payout handler ("Release all" for held escrows).
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  resolver: null as null | Resolver,
  writes: [] as RecordedWrite[],
  intents: {} as Record<string, { metadata: Record<string, string>; status: string }>,
  captured: [] as string[],
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => {
    const client: any = (globalThis as any).__makeFake(world.resolver, world.writes);
    client.auth = {
      getUser: async () => ({ data: { user: { id: "brand", email: "brand@example.com" } } }),
      admin: { getUserById: async () => ({ data: { user: { email: "creative@example.com" } } }) },
    };
    return client;
  },
}));
vi.mock("https://esm.sh/stripe@18.5.0", () => ({
  default: class {
    paymentIntents = {
      retrieve: async (id: string) => world.intents[id],
      capture: async (id: string) => { world.captured.push(id); return { status: "succeeded" }; },
    };
  },
}));

const BRAND = "brand";
const held = (id: string, extra: Record<string, unknown> = {}) => ({
  id, title: `Milestone ${id}`, project_id: "p1", created_by: BRAND, requested_by: null,
  status: "review", escrow_status: "authorized", payment_intent_id: `pi_${id}`, amount: 100, paid_at: null,
  projects: { id: "p1", title: "Film", created_by: BRAND }, ...extra,
});

async function run(milestones: any[], intents: Record<string, Record<string, string>>, collaborators: { user_id: string; role: string }[] = []) {
  world.writes = [];
  world.captured = [];
  world.intents = Object.fromEntries(Object.entries(intents).map(([k, metadata]) => [k, { metadata, status: "requires_capture" }]));
  world.resolver = ({ table, op, inFilters }) => {
    if (table === "projects") return { data: { id: "p1", created_by: BRAND, client_user_id: null } };
    if (table === "milestones") return { data: inFilters.id ? milestones : (op === "list" ? milestones : milestones[0]) };
    if (table === "project_collaborators") return { data: collaborators };
    if (table === "profiles") return { data: { full_name: "Someone" } };
    return { data: op === "list" ? [] : null };
  };
  const res = await world.handler!(
    new Request("https://fn.example/batch", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
      body: JSON.stringify({ projectId: "p1", milestoneIds: milestones.map((m) => m.id) }),
    }),
  );
  return { res, json: await res.json(), writes: world.writes, captured: world.captured };
}
const writesTo = (w: RecordedWrite[], table: string, op?: string) => w.filter((x) => x.table === table && (!op || x.op === op));

beforeAll(async () => {
  (globalThis as any).__makeFake = makeFakeClient;
  (globalThis as any).Deno = { env: { get: (k: string) => ({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_TEST: "sk_test_1", SUPABASE_URL: "https://x.supabase.co" } as Record<string, string>)[k] } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../../supabase/functions/batch-milestone-payout/index.ts");
});

describe("batch-milestone-payout: releasing several held escrows", () => {
  it("credits each milestone's own recorded payee", async () => {
    const { json, writes, captured } = await run(
      [held("a"), held("b")],
      { pi_a: { userId: BRAND, payeeUserId: "c1" }, pi_b: { userId: BRAND, payeeUserId: "c2" } },
    );
    expect(json.summary.captured).toBe(2);
    expect(captured.sort()).toEqual(["pi_a", "pi_b"]);
    const paidTo = writesTo(writes, "milestones", "update").map((w) => (w.payload as any).paid_to);
    expect(paidTo).toEqual(["c1", "c2"]);
    expect(writesTo(writes, "invoices", "insert").map((w) => (w.payload as any).issued_to)).toEqual(["c1", "c2"]);
  });

  it("with no payee identified the money is still captured, credited to nobody, and the payer is told", async () => {
    const { json, writes, captured } = await run([held("a")], { pi_a: { userId: BRAND } }, []);
    expect(json.results[0]).toMatchObject({ status: "captured", success: true });
    expect(captured).toEqual(["pi_a"]);
    expect((writesTo(writes, "milestones", "update")[0].payload as any).paid_to).toBeNull();
    expect(writesTo(writes, "invoices")).toHaveLength(0);
    const notice = writesTo(writes, "notifications", "insert")[0].payload as any;
    expect(notice.user_id).toBe(BRAND);
    expect(notice.title).toMatch(/creative not identified/);
  });

  it("an escrow whose recorded payer is someone else is not released", async () => {
    const { json, captured } = await run([held("a")], { pi_a: { userId: "someone-else", payeeUserId: "c1" } });
    expect(captured).toEqual([]);
    expect(json.results[0].status).toBe("error");
  });
});
