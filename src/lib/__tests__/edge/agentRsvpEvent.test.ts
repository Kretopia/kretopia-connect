import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the real agent-rsvp-event handler (the Kreto agent RSVPing a user to an event).
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  user: { id: "me" } as null | { id: string },
  event: null as null | { is_ticketed?: boolean | null; external_ticket_url?: string | null },
  rpcCalls: [] as unknown[],
  adminReads: [] as unknown[],
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, key: string) => {
    if (key === "service-key") {
      return {
        from: (table: string) => {
          const chain: any = {
            select: () => chain,
            eq: (k: string, v: unknown) => { world.adminReads.push([table, k, v]); return chain; },
            maybeSingle: () => Promise.resolve({ data: world.event }),
          };
          return chain;
        },
      };
    }
    return {
      auth: { getUser: async () => ({ data: { user: world.user } }) },
      rpc: async (...a: unknown[]) => { world.rpcCalls.push(a); return { data: "joined", error: null }; },
    };
  },
}));

const call = async (body: Record<string, unknown> = { event_id: "ev1" }) => {
  const res = await world.handler!(
    new Request("https://fn.example/agent-rsvp-event", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(body) }),
  );
  return { res, json: await res.json() };
};

beforeAll(async () => {
  (globalThis as any).Deno = {
    serve: (h: any) => { world.handler = h; },
    env: { get: (k: string) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon-key", SUPABASE_SERVICE_ROLE_KEY: "service-key" } as Record<string, string>)[k] },
  };
  await import("../../../../supabase/functions/agent-rsvp-event/index.ts");
});
beforeEach(() => {
  world.user = { id: "me" };
  world.event = { is_ticketed: false, external_ticket_url: null };
  world.rpcCalls = [];
  world.adminReads = [];
});

describe("agent-rsvp-event", () => {
  it("RSVPs to a free event as before", async () => {
    const { res, json } = await call();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, result: "joined" });
    expect(world.rpcCalls).toHaveLength(1);
    expect((world.rpcCalls[0] as any[])[1]).toMatchObject({ p_event_id: "ev1", p_referral_channel: "agent" });
  });

  it("refuses a ticketed event: the agent cannot put anyone on a paid guest list for free", async () => {
    world.event = { is_ticketed: true, external_ticket_url: null };
    const { res, json } = await call();
    expect(res.status).toBe(409);
    expect(json).toMatchObject({ ok: false, code: "TICKET_REQUIRED" });
    expect(world.rpcCalls).toHaveLength(0);
  });

  it("refuses an event whose tickets are sold elsewhere", async () => {
    world.event = { is_ticketed: false, external_ticket_url: "https://tickets.example/1" };
    const { res, json } = await call();
    expect(res.status).toBe(409);
    expect(json.code).toBe("TICKET_REQUIRED");
    expect(world.rpcCalls).toHaveLength(0);
  });

  it("does not even look the event up for someone who is not signed in", async () => {
    world.user = null;
    const { res } = await call();
    expect(res.status).toBe(401);
    expect(world.adminReads).toHaveLength(0);
    expect(world.rpcCalls).toHaveLength(0);
  });

  it("still validates its input first", async () => {
    const { res } = await call({});
    expect(res.status).toBe(400);
    expect(world.rpcCalls).toHaveLength(0);
  });
});
