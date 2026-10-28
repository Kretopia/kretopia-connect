import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDiscoveryDb } from "../discovery/fakeDiscoveryDb";

// Runs the REAL external-import, external-claim and external-discovery-run handlers with the auth guards, the database and
// the rate limiter replaced by fakes: who may call which action, what an anonymous caller can reach, and that an identity
// in the request body is never used.
const world = vi.hoisted(() => ({
  handlers: {} as Record<string, (r: Request) => Promise<Response>>,
  current: "",
  db: null as unknown as ReturnType<typeof import("../discovery/fakeDiscoveryDb").makeDiscoveryDb>,
  user: null as string | null,
  admin: null as { userId: string | null; viaCron: boolean } | null,
  rate: true,
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2.49.4", () => ({
  createClient: () => ({
    rpc: (n: string, a: Record<string, unknown>) => world.db.rpc(n, a),
    from: (t: string) => {
      const q = world.db.from(t === "public_external_listings" ? "external_listings" : t) as Record<string, (...a: unknown[]) => unknown>;
      return q;
    },
  }),
}));
vi.mock("../../../../supabase/functions/_shared/require-user.ts", () => ({
  requireUser: async () => (world.user ? { ok: true, userId: world.user } : { ok: false, response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) }),
}));
vi.mock("../../../../supabase/functions/_shared/admin-guard.ts", () => ({
  requireAdminOrCron: async () => (world.admin ? { ok: true, ...world.admin } : { ok: false, response: new Response(JSON.stringify({ error: "Admin role required" }), { status: 403 }) }),
}));
vi.mock("../../../../supabase/functions/_shared/aiRateLimit.ts", () => ({
  checkAiFeatureRateLimit: async () => (world.rate ? { allowed: true, used: 1, cap: 40 } : { allowed: false, response: new Response(JSON.stringify({ error: "limit" }), { status: 429 }) }),
}));

const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key", CLAIM_CHALLENGE_SECRET: "c-secret" };
const call = (fn: string, body: unknown, method = "POST") => world.handlers[fn](new Request("https://fn.example", { method, body: method === "POST" ? JSON.stringify(body) : undefined }));
const UUID = "11111111-1111-4111-8111-111111111111";

beforeAll(async () => {
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] }, serve: (h: (r: Request) => Promise<Response>) => { world.handlers[world.current] = h; } };
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const fn of ["external-import", "external-claim", "external-discovery-run"]) {
    world.current = fn;
    await import(`../../../../supabase/functions/${fn}/index.ts`);
  }
});
beforeEach(() => {
  world.db = makeDiscoveryDb();
  world.user = null;
  world.admin = null;
  world.rate = true;
});

describe("external-import", () => {
  it("rejects a non-POST, a non-JSON body and an unknown action", async () => {
    expect((await call("external-import", null, "GET")).status).toBe(405);
    expect((await world.handlers["external-import"](new Request("https://fn.example", { method: "POST", body: "not json" }))).status).toBe(400);
    world.user = "u1";
    expect((await call("external-import", { action: "nope" })).status).toBe(400);
  });

  it("any import needs a signed-in user", async () => {
    expect((await call("external-import", { action: "ingest", input: { type: "url", url: "https://remoteok.com/x" } })).status).toBe(401);
  });

  it("a signed-in user is rate limited, and a bad input is a 400 before anything runs", async () => {
    world.user = "u1";
    world.rate = false;
    expect((await call("external-import", { action: "ingest", input: { type: "url", url: "https://remoteok.com/x" } })).status).toBe(429);
    world.rate = true;
    expect((await call("external-import", { action: "ingest", input: { type: "carrier-pigeon" } })).status).toBe(400);
    expect((await call("external-import", { action: "ingest", input: { type: "url", url: "https://evil.example/x" } })).status).toBe(422);
  });

  it("review, claim links, claim decisions and hosted applications are admin only: a user, and the cron secret, are refused", async () => {
    world.user = "u1"; // signed in, not an admin
    for (const body of [{ action: "review", listing_id: UUID, decision: "approve" }, { action: "claim_link", listing_id: UUID }, { action: "decide_claim", claim_id: UUID, decision: "approve" }, { action: "set_applications", listing_id: UUID, enabled: true }, { action: "list_review" }]) {
      expect((await call("external-import", body)).status, body.action).toBe(403);
    }
    world.admin = { userId: null, viaCron: true }; // the cron secret is not a person
    for (const body of [{ action: "review", listing_id: UUID, decision: "approve" }, { action: "claim_link", listing_id: UUID }]) {
      expect((await call("external-import", body)).status, body.action).toBe(403);
    }
    expect(world.db.listings.size).toBe(0);
  });

  it("an admin's review and claim link go through; a malformed id is a 400", async () => {
    world.admin = { userId: "admin-1", viaCron: false };
    expect((await call("external-import", { action: "review", listing_id: "not-a-uuid", decision: "approve" })).status).toBe(400);
    expect((await call("external-import", { action: "claim_link", listing_id: UUID })).status).toBe(409); // no such published listing: refused, not created
  });

  it("a user lists only their own drafts", async () => {
    world.user = "u1";
    world.db.rpc("import_external_listing", { p_actor: "u1", p_row: { kind: "gig", source_type: "text", title: "Mine" } });
    world.db.rpc("import_external_listing", { p_actor: "u2", p_row: { kind: "gig", source_type: "text", title: "Theirs" } });
    await Promise.resolve();
    const r = await (await call("external-import", { action: "list_mine" })).json();
    expect(r.listings.map((l: { title: string }) => l.title)).toEqual(["Mine"]);
  });
});

describe("external-claim", () => {
  it("the preview is public (no sign-in), reads the PUBLIC view only and selects no internal column", async () => {
    world.db.listings.set(UUID, { id: UUID, kind: "gig", title: "Public role", original_publisher: "Acme", claimed: false, status: "published", created_by: "u1", owner_user_id: null });
    const ok = await call("external-claim", { action: "preview", listing_id: UUID });
    expect(ok.status).toBe(200);
    expect((await ok.json()).listing).toMatchObject({ title: "Public role", original_publisher: "Acme" });
    expect((await call("external-claim", { action: "preview", listing_id: "11111111-1111-4111-8111-222222222222" })).status).toBe(404);
    expect((await call("external-claim", { action: "preview", listing_id: "nope" })).status).toBe(400);
    const src = readFileSync(resolve(__dirname, "../../../../supabase/functions/external-claim/index.ts"), "utf8");
    const select = src.match(/from\("public_external_listings"\)\.select\("([^"]+)"\)/)![1];
    for (const hidden of ["created_by", "owner_user_id", "provenance", "identity_key", "token", "possible_duplicates", "extraction_issues"]) expect(select).not.toContain(hidden);
  });

  it("redeem, verify, review requests, owner updates and disputes need a signed-in user", async () => {
    for (const body of [{ action: "redeem", listing_id: UUID, token: "x" }, { action: "start", claim_id: UUID }, { action: "verify_domain", claim_id: UUID }, { action: "request_review", claim_id: UUID }, { action: "owner_update", listing_id: UUID, edits: { description_full: "x" } }, { action: "dispute", listing_id: UUID, reason: "r" }]) {
      expect((await call("external-claim", body)).status, body.action).toBe(401);
    }
  });

  it("a claimant is rate limited, a malformed token is refused, and an owner id in the body is ignored", async () => {
    world.user = "claimant";
    world.rate = false;
    expect((await call("external-claim", { action: "redeem", listing_id: UUID, token: "kc_x" })).status).toBe(429);
    world.rate = true;
    expect((await call("external-claim", { action: "redeem", listing_id: UUID, token: "not-a-token" })).status).toBe(400);
    const spy = vi.spyOn(world.db, "rpc");
    await call("external-claim", { action: "owner_update", listing_id: UUID, edits: { description_full: "x" }, owner_user_id: "someone-else", p_owner: "someone-else", user_id: "someone-else" });
    const sent = spy.mock.calls.find((c) => c[0] === "owner_update_external_listing")![1] as Record<string, unknown>;
    expect(sent.p_owner).toBe("claimant");
  });
});

describe("external-discovery-run", () => {
  it("needs an admin or the cron secret", async () => {
    expect((await call("external-discovery-run", {})).status).toBe(403);
  });

  it("with the kill switch off it does nothing, and says so", async () => {
    world.admin = { userId: null, viaCron: true };
    world.db = makeDiscoveryDb({ settings: { enabled: false } });
    const r = await (await call("external-discovery-run", {})).json();
    expect(r).toMatchObject({ ok: true, ran: [], skipped: "kill_switch_off", via: "schedule" });
  });
});
