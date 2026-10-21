import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the real send-get-paid-link handler with a fake database and a fake mailer. Resend's SDK does not throw
// when it refuses a send (for example a sender domain that is not verified): it returns `error`.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  sendError: null as null | { name: string; message: string },
  sent: [] as Array<{ to: string[] }>,
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/resend@4.0.0", () => ({
  Resend: class {
    emails = { send: async (m: any) => { world.sent.push({ to: m.to }); return world.sendError ? { data: null, error: world.sendError } : { data: { id: "mail-1" }, error: null }; } };
  },
}));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => {
  const query = (row: unknown) => {
    const q: any = {};
    q.select = () => q; q.eq = () => q;
    q.maybeSingle = async () => ({ data: row, error: null });
    q.single = async () => ({ data: row, error: null });
    q.insert = async () => ({ error: null });
    return q;
  };
  return {
    createClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "owner-1", email: "owner@example.com" } } }),
        admin: { listUsers: async () => ({ data: { users: [] } }) },
      },
      from: (table: string) => query(table === "projects" ? { title: "Q&A shoot" } : { full_name: "Owner" }),
    }),
  };
});
vi.mock("../../../../supabase/functions/_shared/projectAccess.ts", () => ({
  requireProjectAccess: async () => ({ canSeeMoney: true }),
  ProjectAccessError: class extends Error { status = 403; },
}));

const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-key", RESEND_API_KEY: "re_test" };
const PROJECT = "11111111-1111-4111-8111-111111111111";

beforeAll(async () => {
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../../supabase/functions/send-get-paid-link/index.ts");
});
beforeEach(() => { world.sent = []; world.sendError = null; });

const send = () =>
  world.handler!(new Request("https://fn.example/get-paid", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ projectId: PROJECT, recipientEmail: "Pat@Example.com" }) }));

describe("send-get-paid-link: what it reports about the email", () => {
  it("says the email was sent when Resend accepted it", async () => {
    const res = await send();
    expect(res.status).toBe(200);
    expect((await res.json()).emailSent).toBe(true);
    expect(world.sent).toEqual([{ to: ["pat@example.com"] }]);
  });

  it("says it was NOT sent when Resend refused it, instead of claiming success", async () => {
    world.sendError = { name: "validation_error", message: "The kretopia.com domain is not verified." };
    const res = await send();
    expect(res.status).toBe(200);
    expect((await res.json()).emailSent).toBe(false);
  });
});
