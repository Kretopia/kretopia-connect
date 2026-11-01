// Runs the real send-outreach-draft handler with a fake database and a fake mail library. Prospection mail leaves from the
// member's own Gmail: one plain recipient, a one-line subject, a body shown as text, a bounded volume, and an approved
// agent send is spent only when the mail is really going.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CountingDb } from "./countingDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  sub: "user-1" as string | null,
  smtp: { sent: [] as Array<{ from: string; to: string; subject: string; content: string; html: string }>, fail: false },
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("https://deno.land/x/denomailer@1.6.0/mod.ts", () => ({
  SMTPClient: class {
    async send(message: { from: string; to: string; subject: string; content: string; html: string }) {
      if (world.smtp.fail) throw new Error("535 authentication failed");
      world.smtp.sent.push(message);
    }
    async close() {}
  },
}));
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.4", () => ({
  createClient: (_url: string, key: string) =>
    key === "anon-key"
      ? { auth: { getClaims: async () => (world.sub ? { data: { claims: { sub: world.sub } }, error: null } : { data: null, error: { message: "bad" } }) } }
      : { from: (table: string) => (world.db as CountingDb).from(table) },
}));

const env: Record<string, string> = { SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key" };
beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  await import("../../../../supabase/functions/send-outreach-draft/index.ts");
});

const USER = "user-1";
const DRAFT = "draft-1";
const ACTION = "act-1";
const fresh = () => new Date(Date.now() - 5_000).toISOString();
const seed = (draft: Record<string, unknown> = {}, opts: { approved?: boolean } = {}) =>
  new CountingDb()
    .seed("outreach_drafts", [{ id: DRAFT, user_id: USER, status: "draft", subject: "Collab idea", body: "Hello Sam,\n\nLet's work together.", recipient_email: "sam@brand.test", lead_id: null, source: null, meta: null, ...draft }])
    .seed("user_email_settings", [{ user_id: USER, provider: "gmail", gmail_email: "me@gmail.test", gmail_app_password: "app-pass", is_configured: true }])
    .seed("orch_actions", opts.approved ? [{ id: ACTION, user_id: USER, status: "approved", tool_name: "send_outreach_email", tool_args: { draft_id: DRAFT }, decided_at: fresh(), executed_at: null }] : [])
    .seed("orch_approvals", opts.approved ? [{ id: "ap-1", action_id: ACTION, user_id: USER, decision: "approved", edited_args: null, decided_at: fresh() }] : []);

const send = (body: Record<string, unknown> = {}) =>
  world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer user-token", Origin: "https://www.kretopia.com" }, body: JSON.stringify({ draft_id: DRAFT, ...body }) }));
const draft = (db: CountingDb) => db.rows("outreach_drafts")[0];
const actionStatus = (db: CountingDb) => db.rows("orch_actions")[0]?.status;

beforeEach(() => {
  world.sub = USER;
  world.smtp = { sent: [], fail: false };
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("send-outreach-draft: what leaves the member's Gmail", () => {
  it("sends to one clean address with a one-line subject and records the send", async () => {
    const db = (world.db = seed()) as CountingDb;
    const res = await send();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent_to: "sam@brand.test" });
    expect(world.smtp.sent).toHaveLength(1);
    expect(world.smtp.sent[0]).toMatchObject({ from: "me@gmail.test", to: "sam@brand.test", subject: "Collab idea" });
    expect(draft(db).status).toBe("sent");
    expect(db.rows("email_send_log")).toHaveLength(1);
    expect(db.rows("email_send_log")[0]).toMatchObject({ template_name: "outreach-gmail-direct", recipient_email: "sam@brand.test", metadata: { actor_user_id: USER } });
  });

  it("shows the body as text: markup in a draft (it may come from a model reading someone else's page) is escaped", async () => {
    world.db = seed({ body: 'Hi <img src=x onerror=alert(1)>\n\n<a href="https://evil.test">click</a> & more' });
    expect((await send()).status).toBe(200);
    const { html } = world.smtp.sent[0];
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a href");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&amp; more");
    expect(world.smtp.sent[0].content).toContain("<img"); // the plain-text part is text anyway
  });

  it("cannot be given a second header through the subject", async () => {
    world.db = seed({ subject: "Hello\r\nBcc: victim@x.test\r\nX-Evil: 1" });
    expect((await send()).status).toBe(200);
    expect(world.smtp.sent[0].subject).not.toMatch(/[\r\n]/);
  });

  it("refuses a draft with no usable subject", async () => {
    const db = (world.db = seed({ subject: "\r\n  " })) as CountingDb;
    expect((await send()).status).toBe(400);
    expect(world.smtp.sent).toHaveLength(0);
    expect(db.rows("email_send_log")).toHaveLength(0);
  });
});

describe("send-outreach-draft: the recipient is one plain address, checked before anything is claimed or sent", () => {
  const bad = ["a@x.com, b@y.com", "a@x.com;b@y.com", "a@x.com\r\nBcc: v@y.com", "<x>@y.com", "no-at", "a@b", " "];
  for (const recipient_email of bad) {
    it(`refuses ${JSON.stringify(recipient_email)} typed in the app`, async () => {
      const db = (world.db = seed()) as CountingDb;
      const res = await send({ recipient_email });
      expect(res.status).toBe(400);
      expect(world.smtp.sent).toHaveLength(0);
      expect(db.rows("email_send_log")).toHaveLength(0);
      expect(draft(db).status).not.toBe("sent");
    });
  }

  it("refuses a bad address stored on the draft too, and an approved agent send keeps its approval", async () => {
    const db = (world.db = seed({ recipient_email: "a@x.com, b@y.com" }, { approved: true })) as CountingDb;
    expect((await send({ _agent_action_id: ACTION, _source: "agent_orchestrator" })).status).toBe(400);
    expect(world.smtp.sent).toHaveLength(0);
    expect(actionStatus(db)).toBe("approved");
  });

  it("lets a person in the app send to an external address that was never on the platform", async () => {
    world.db = seed({ recipient_email: null });
    expect((await send({ recipient_email: "founder@new-brand.example" })).status).toBe(200);
    expect(world.smtp.sent[0].to).toBe("founder@new-brand.example");
  });
});

describe("send-outreach-draft: volume", () => {
  const prior = (n: number, over: Record<string, unknown> = {}) =>
    Array.from({ length: n }, (_, i) => ({ id: `log-${i}`, template_name: "outreach-gmail-direct", recipient_email: `p${i}@x.test`, status: "sent", created_at: new Date(Date.now() - 60_000).toISOString(), metadata: { actor_user_id: USER }, ...over }));

  it("refuses the 31st mail of the hour, and an approved agent send is not spent", async () => {
    const db = (world.db = seed({}, { approved: true }).seed("email_send_log", prior(30))) as CountingDb;
    expect((await send({ _agent_action_id: ACTION, _source: "agent_orchestrator" })).status).toBe(429);
    expect(world.smtp.sent).toHaveLength(0);
    expect(actionStatus(db)).toBe("approved");
    expect(db.rows("email_send_log")).toHaveLength(30);
  });

  it("refuses a fourth mail to the same address in the hour, whoever sent the others", async () => {
    world.db = seed().seed("email_send_log", prior(3, { recipient_email: "sam@brand.test", metadata: { actor_user_id: "someone-else" } }));
    expect((await send()).status).toBe(429);
    expect(world.smtp.sent).toHaveLength(0);
  });

  it("fails closed when the registry cannot be read or written", async () => {
    const readFails = (world.db = seed()) as CountingDb;
    readFails.hooks.failOn = (t, op) => (t === "email_send_log" && op === "select" ? { message: "down" } : null);
    expect((await send()).status).toBe(503);
    const writeFails = (world.db = seed({}, { approved: true })) as CountingDb;
    writeFails.hooks.failOn = (t, op) => (t === "email_send_log" && op === "insert" ? { message: "down" } : null);
    expect((await send({ _agent_action_id: ACTION, _source: "agent_orchestrator" })).status).toBe(503);
    expect(world.smtp.sent).toHaveLength(0);
    expect(actionStatus(writeFails)).toBe("approved"); // the claim was given back
  });
});

describe("send-outreach-draft: an approved agent send is one approval, one mail", () => {
  it("sends once for the approved draft and refuses a second use of the same approval", async () => {
    const db = (world.db = seed({}, { approved: true })) as CountingDb;
    expect((await send({ _agent_action_id: ACTION, _source: "agent_orchestrator" })).status).toBe(200);
    expect(actionStatus(db)).toBe("executed");
    draft(db).status = "draft"; // the draft is reset, the approval is not
    expect((await send({ _agent_action_id: ACTION, _source: "agent_orchestrator" })).status).toBe(409);
    expect(world.smtp.sent).toHaveLength(1);
  });

  it("gives the approval back when the mail library fails, and marks the draft failed", async () => {
    const db = (world.db = seed({}, { approved: true })) as CountingDb;
    world.smtp.fail = true;
    expect((await send({ _agent_action_id: ACTION, _source: "agent_orchestrator" })).status).toBe(500);
    expect(actionStatus(db)).toBe("approved");
    expect(draft(db).status).toBe("failed");
  });

  it("refuses an agent send with no approval at all", async () => {
    const db = (world.db = seed()) as CountingDb;
    expect((await send({ _source: "desk_agent" })).status).toBe(428);
    expect(world.smtp.sent).toHaveLength(0);
    expect(db.rows("email_send_log")).toHaveLength(0);
  });
});
