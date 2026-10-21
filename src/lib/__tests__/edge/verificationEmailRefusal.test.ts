import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the real verify-brand-credit (request) and verify-guest-opportunity (send-verification) handlers with a fake
// database and a fake Resend HTTP API. A refused or impossible send must not be answered as success: the brand or the
// poster would wait for a link that never comes.
const world = vi.hoisted(() => ({
  brand: null as null | ((r: Request) => Promise<Response>),
  guest: null as null | ((r: Request) => Promise<Response>),
  resend: { ok: true, status: 200 },
  fetched: [] as string[],
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: any) => { world.brand = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => {
  const rows = (table: string, inserted: boolean) => {
    if (table === "opportunities") return inserted ? { data: { id: "opp-1" }, error: null } : { count: 0, error: null };
    if (table === "icdb_project_roles") return { data: { claimed_by: "user-1" }, error: null };
    if (table === "icdb_brand_verifications") return { data: { verification_token: "tok-1" }, error: null };
    if (table === "profiles") return { data: { full_name: "Creator" }, error: null };
    if (table === "icdb_projects") return { data: { title: "Film" }, error: null };
    return { data: null, error: null };
  };
  const chain = (table: string) => {
    let inserted = false;
    const q: any = new Proxy({}, {
      get: (_t, prop) => {
        if (prop === "then") return (resolve: (v: unknown) => unknown) => resolve(rows(table, inserted));
        if (prop === "insert") return () => { inserted = true; return q; };
        return () => q;
      },
    });
    return q;
  };
  return {
    createClient: () => ({
      from: (table: string) => chain(table),
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "https://x/y" } }) }) },
    }),
  };
});

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-key", RESEND_API_KEY: "re_test", SITE_URL: "https://www.kretopia.com",
};

beforeAll(async () => {
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] }, serve: (h: any) => { world.guest = h; } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/verify-brand-credit/index.ts");
  await import("../../../../supabase/functions/verify-guest-opportunity/index.ts");
});

beforeEach(() => {
  ENV.RESEND_API_KEY = "re_test";
  world.resend = { ok: true, status: 200 };
  world.fetched = [];
  globalThis.fetch = vi.fn(async (url: any) => {
    world.fetched.push(String(url));
    return world.resend.ok
      ? new Response(JSON.stringify({ id: "mail-1" }), { status: 200 })
      : new Response(JSON.stringify({ name: "validation_error", message: "The kretopia.com domain is not verified." }), { status: world.resend.status });
  }) as typeof fetch;
});

const post = (handler: (r: Request) => Promise<Response>, body: Record<string, unknown>) =>
  handler(new Request("https://fn.example/x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(body) }));
const brand = () => post(world.brand!, { action: "request", roleId: "role-1", projectId: "proj-1", brandEmail: "brand@example.com", brandName: "Acme" });
const guest = () => post(world.guest!, { action: "send-verification", email: "guest@example.com", company_name: "Acme", title: "Shoot", description: "A shoot", type: "collaboration" });

describe("verify-brand-credit: the request email", () => {
  it("answers success when Resend accepted the email", async () => {
    const res = await brand();
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(world.fetched).toEqual(["https://api.resend.com/emails"]);
  });

  it("answers 502, not success, when Resend refused it", async () => {
    world.resend = { ok: false, status: 403 };
    const res = await brand();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBeUndefined();
    expect(body.error).toMatch(/couldn't send/i);
  });

  it("answers 502 when no Resend key is configured", async () => {
    ENV.RESEND_API_KEY = undefined;
    expect((await brand()).status).toBe(502);
  });
});

describe("verify-guest-opportunity: the verification email", () => {
  it("answers success when Resend accepted the email", async () => {
    const res = await guest();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, opportunityId: "opp-1" });
  });

  it("answers 502, not success, when Resend refused it", async () => {
    world.resend = { ok: false, status: 403 };
    const res = await guest();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBeUndefined();
    expect(body.error).toMatch(/couldn't send/i);
  });

  it("answers 502 when no Resend key is configured", async () => {
    ENV.RESEND_API_KEY = undefined;
    expect((await guest()).status).toBe(502);
  });
});
