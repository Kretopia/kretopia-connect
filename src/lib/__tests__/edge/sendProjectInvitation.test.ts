import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Runs the real send-project-invitation handler against an in-memory database, a fake auth admin and a fake mailer.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as any,
  generateLink: null as null | ((args: any) => Promise<any>),
  sent: [] as Array<{ to: string[]; html: string }>,
  /** What Resend answers as `error` (null = the send is accepted). */
  sendError: null as null | { name: string; message: string },
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/resend@4.0.0", () => ({
  Resend: class {
    emails = { send: async (m: any) => { world.sent.push({ to: m.to, html: m.html }); return world.sendError ? { data: null, error: world.sendError } : { data: { id: "mail-1" }, error: null }; } };
  },
}));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, _key: string, opts?: any) =>
    opts?.global?.headers
      ? { auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) } }
      : {
          from: (t: string) => world.db.from(t),
          auth: { admin: { generateLink: (args: any) => world.generateLink!(args) } },
        },
}));
vi.mock("../../../../supabase/functions/_shared/projectAccess.ts", () => ({
  requireProjectAccess: async () => undefined,
  ProjectAccessError: class extends Error { status = 403; },
}));
vi.mock("../../../../supabase/functions/_shared/outboundBudget.ts", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  countActorSends: async () => 0,
  countRecipientSends: async () => 0,
  recordActorSend: async () => undefined,
}));

const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-key", RESEND_API_KEY: "re_test" };
const PROJECT = "11111111-1111-4111-8111-111111111111";
const EMAIL = "Invitee@Example.com";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

beforeAll(async () => {
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/send-project-invitation/index.ts");
});

beforeEach(() => {
  world.sent = [];
  world.sendError = null;
  world.db = new MemoryDb()
    .seed("projects", [{ id: PROJECT, created_by: "owner-1", title: "Q&A shoot" }])
    .seed("profiles", [{ user_id: "owner-1", full_name: "Owner" }])
    .seed("project_collaborators", [{ id: "pc-1", project_id: PROJECT, email: EMAIL.toLowerCase(), status: "pending", invite_secret_hash: null }]);
  world.generateLink = async () => ({ data: { properties: { action_link: "https://auth.example/magic?token=abc" } }, error: null });
});

const invite = (body: Record<string, unknown> = { email: EMAIL, projectId: PROJECT }) =>
  world.handler!(new Request("https://fn.example/invite", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(body) }));
const redirectOf = (call: any) => new URL(call.options.redirectTo);

describe("send-project-invitation: invite secret", () => {
  it("puts a secret in the link and stores only its hash on the pending invitation", async () => {
    const seen: any[] = [];
    world.generateLink = async (args) => { seen.push(args); return { data: { properties: { action_link: "https://auth.example/magic" } }, error: null }; };
    const res = await invite();
    expect(res.status).toBe(200);
    expect((await res.json()).emailSent).toBe(true);

    const redirect = redirectOf(seen[0]);
    const secret = redirect.searchParams.get("t")!;
    expect(secret).toMatch(/^[A-Za-z0-9_-]{32}$/); // 24 bytes, base64url
    expect(redirect.searchParams.get("email")).toBe(EMAIL.toLowerCase()); // the handler normalises the address
    const stored = world.db.rows("project_collaborators")[0].invite_secret_hash;
    expect(stored).toBe(sha256(secret));
    expect(JSON.stringify(world.db.rows("project_collaborators"))).not.toContain(secret);
  });

  it("a resend replaces the secret, so an older emailed link no longer opens the preview", async () => {
    const seen: any[] = [];
    world.generateLink = async (args) => { seen.push(args); return { data: { properties: { action_link: "https://auth.example/magic" } }, error: null }; };
    await invite();
    await invite();
    const [first, second] = seen.map((a) => redirectOf(a).searchParams.get("t")!);
    expect(first).not.toBe(second);
    expect(world.db.rows("project_collaborators")[0].invite_secret_hash).toBe(sha256(second));
  });

  it("sends the invitation without a secret when none can be stored, and the invitation stays on the address-only check", async () => {
    world.db.hooks.failOn = (table, op) => (table === "project_collaborators" && op === "update" ? { message: "db down" } : null);
    const seen: any[] = [];
    world.generateLink = async (args) => { seen.push(args); return { data: { properties: { action_link: "https://auth.example/magic" } }, error: null }; };
    const res = await invite();
    expect((await res.json()).emailSent).toBe(true);
    expect(redirectOf(seen[0]).searchParams.has("t")).toBe(false);
    expect(world.db.rows("project_collaborators")[0].invite_secret_hash).toBeNull();
  });

  it("adds no secret when there is no pending invitation for the address", async () => {
    world.db.rows("project_collaborators")[0].status = "accepted";
    const seen: any[] = [];
    world.generateLink = async (args) => { seen.push(args); return { data: { properties: { action_link: "https://auth.example/magic" } }, error: null }; };
    await invite();
    expect(redirectOf(seen[0]).searchParams.has("t")).toBe(false);
    expect(world.db.writes("project_collaborators", "update")).toHaveLength(0);
  });

  it("the fallback link keeps the secret when no sign-in link can be issued", async () => {
    world.generateLink = async () => { throw new Error("auth down"); };
    world.db.hooks.failOn = (table, op) => (table === "guest_studio_tokens" && op === "insert" ? { message: "no tokens" } : null);
    await invite();
    const html = world.sent[0].html;
    const link = /href="([^"]+)"/.exec(html)![1];
    const url = new URL(link);
    expect(url.pathname).toBe(`/accept-invite/${PROJECT}`);
    expect(sha256(url.searchParams.get("t")!)).toBe(world.db.rows("project_collaborators")[0].invite_secret_hash);
  });
});

describe("send-project-invitation: preview token fallback", () => {
  const noMagicLink = () => { world.generateLink = async () => { throw new Error("auth down"); }; };

  it("a preview token minted here expires in 14 days", async () => {
    noMagicLink();
    await invite();
    const tokens = world.db.rows("guest_studio_tokens");
    expect(tokens).toHaveLength(1);
    const days = (new Date(tokens[0].expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
  });

  it("an expired token for the address is not reused", async () => {
    noMagicLink();
    world.db.seed("guest_studio_tokens", [{ id: "g-old", token: "old-token", project_id: PROJECT, guest_email: EMAIL.toLowerCase(), revoked_at: null, expires_at: new Date(Date.now() - 1000).toISOString() }]);
    await invite();
    const tokens = world.db.rows("guest_studio_tokens");
    expect(tokens).toHaveLength(2);
    expect(world.sent[0].html).not.toContain("old-token");
  });

  it("a live token for the address is reused, and none is minted", async () => {
    noMagicLink();
    world.db.seed("guest_studio_tokens", [{ id: "g-live", token: "live-token", project_id: PROJECT, guest_email: EMAIL.toLowerCase(), revoked_at: null, expires_at: null }]);
    await invite();
    expect(world.db.rows("guest_studio_tokens")).toHaveLength(1);
    expect(world.sent[0].html).toContain("/guest/live-token");
  });
});

describe("send-project-invitation: a refused send", () => {
  it("answers 200 with emailSent false and a readable reason, not [object Object]", async () => {
    world.sendError = { name: "validation_error", message: "The kretopia.com domain is not verified." };
    const res = await invite();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailSent).toBe(false);
    expect(body.emailError).toBe("The kretopia.com domain is not verified.");
  });
});
