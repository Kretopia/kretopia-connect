// Runs the real verify-stage-ticket: after Stripe checkout the return page seats a paid buyer itself, through the webhook's own
// fulfilment, so a ticket is seated even where the webhook has no Stage ticket branch (production on 2026-11-25). A reload sends
// no second email, someone else's or an unpaid session seats nobody, and a private Stage still needs an invitation.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const w = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as unknown,
  user: { id: "fan-1", email: "fan@example.com" } as null | { id: string; email: string },
  session: {} as Record<string, unknown>,
  emails: [] as Array<{ idempotencyKey: string; templateData: Record<string, unknown> }>,
}));
vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: (r: Request) => Promise<Response>) => { w.handler = h; } }));
vi.mock("https://esm.sh/stripe@18.5.0", () => ({ default: class { checkout = { sessions: { retrieve: async () => w.session } }; } }));
// One stand-in for every supabase-js spelling (vitest.config.ts aliases them to the same stub).
vi.mock("npm:@supabase/supabase-js@2.57.2", () => ({
  createClient: () => ({
    from: (t: string) => (w.db as MemoryDb).from(t),
    rpc: async () => ({ data: { allowed: true }, error: null }),
    auth: {
      getUser: async () => ({ data: { user: w.user } }),
      admin: { getUserById: async (id: string) => ({ data: { user: { id, email: id === "fan-1" ? "fan@example.com" : null } } }) },
    },
  }),
}));

const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon", STRIPE_MODE: "test", STRIPE_SECRET_KEY_TEST: "sk_test_x" };
const STAGE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  // Deno has AbortSignal.timeout; jsdom does not.
  if (typeof AbortSignal.timeout !== "function") (AbortSignal as unknown as { timeout: () => AbortSignal }).timeout = () => new AbortController().signal;
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { w.emails.push(JSON.parse(String(init.body))); return new Response("{}"); }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../../supabase/functions/verify-stage-ticket/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  w.db = new MemoryDb()
    .seed("curated_stages", [{ id: STAGE, title: "Paid Night", starts_at: "2026-12-17T20:00:00Z", ends_at: null, visibility: "public", invite_token: null, host_user_id: "host-1" }])
    .seed("curated_stage_orders", [{ id: "o1", stage_id: STAGE, user_id: "fan-1", stripe_session_id: "cs_1", status: "pending" }])
    .seed("profiles", [{ user_id: "host-1", full_name: "Ana" }]);
  w.user = { id: "fan-1", email: "fan@example.com" };
  w.session = { id: "cs_1", payment_status: "paid", amount_total: 1500, currency: "gbp", metadata: { kind: "curated_stage", stage_id: STAGE, user_id: "fan-1", entry_checked: "1" } };
  w.emails = [];
});
const verify = async () => {
  const res = await w.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ session_id: "cs_1" }) }));
  return { status: res.status, body: await res.json() };
};
const db = () => w.db as MemoryDb;

describe("verify-stage-ticket seats a paid buyer", () => {
  it("seats the buyer, marks the order paid and sends one ticket email; a reload changes nothing", async () => {
    expect(await verify()).toEqual({ status: 200, body: { paid: true } });
    expect(db().rows("curated_stage_rsvps")).toEqual([expect.objectContaining({ user_id: "fan-1", status: "rsvp", ticket_order_id: "o1" })]);
    expect(db().rows("curated_stage_orders")[0]).toMatchObject({ status: "paid" });
    expect(w.emails).toHaveLength(1);
    expect(w.emails[0]).toMatchObject({ idempotencyKey: `stage-ticket:${STAGE}:fan-1`, templateData: { ticket: true, paidAmount: "15.00 GBP" } });

    expect(await verify()).toEqual({ status: 200, body: { paid: true } });
    expect(db().rows("curated_stage_rsvps")).toHaveLength(1);
    expect(w.emails).toHaveLength(1);
  });

  it("a buyer the webhook already seated is answered without a second email", async () => {
    db().seed("curated_stage_rsvps", [{ stage_id: STAGE, user_id: "fan-1", status: "rsvp" }]);
    expect(await verify()).toEqual({ status: 200, body: { paid: true } });
    expect(w.emails).toHaveLength(0);
  });

  it("an unpaid session, or someone else's, seats nobody", async () => {
    w.session = { ...w.session, payment_status: "unpaid" };
    expect((await verify()).body).toMatchObject({ paid: false });
    w.session = { ...w.session, payment_status: "paid", metadata: { kind: "curated_stage", stage_id: STAGE, user_id: "someone-else" } };
    expect((await verify()).status).toBe(400);
    expect(db().rows("curated_stage_rsvps")).toHaveLength(0);
    expect(w.emails).toHaveLength(0);
  });

  it("a private Stage without an invitation is not seated, and the buyer is told why", async () => {
    await db().from("curated_stages").update({ visibility: "private", invite_token: "door" }).eq("id", STAGE);
    w.session = { ...w.session, metadata: { kind: "curated_stage", stage_id: STAGE, user_id: "fan-1" } };
    expect(await verify()).toEqual({ status: 200, body: { paid: true, seated: false, reason: "invite_required" } });
    expect(db().rows("curated_stage_rsvps")).toHaveLength(0);
    expect(w.emails).toHaveLength(0);
  });
});
