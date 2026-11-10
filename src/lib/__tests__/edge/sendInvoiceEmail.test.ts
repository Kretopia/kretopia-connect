// Runs the real send-invoice-email handler with a fake database and a fake email provider. Every refusal is
// asserted to happen before the provider is called and before anything is written.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
import { CountingDb } from "./countingDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  tokens: {} as Record<string, string>,
  fetch: vi.fn(),
  env: {} as Record<string, string>,
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => ({
    from: (table: string) => (world.db as CountingDb).from(table),
    auth: { getUser: async (token: string) => (world.tokens[token] ? { data: { user: { id: world.tokens[token] } }, error: null } : { data: { user: null }, error: { message: "bad" } }) },
  }),
}));

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => world.env[k] } });
  await import("../../../../supabase/functions/send-invoice-email/index.ts");
});

const ID = "3f2b8a64-5b7c-4c0e-9d8a-1a2b3c4d5e6f";
const ISSUER = "issuer-1";
const invoiceRow = (over: Record<string, unknown> = {}) => ({
  id: ID, invoice_number: "INV-1", issued_by: ISSUER, issued_to: "client-1", status: "draft", currency: "USD",
  amount: 300, tax_rate: 0, tax_amount: 0, total_amount: 300, brand_name: "Studio Nord", brand_email: "billing@studio.test",
  recipient_name: "Client", line_items: [{ description: "Grade", quantity: 1, rate: 300, amount: 300 }], notes: null, due_date: null, ...over,
});
const seed = (over: Record<string, unknown> = {}) => new CountingDb().seed("invoices", [invoiceRow({ recipient_email: "client@client.test", ...over })]);

const call = (body: unknown, token: string | null = "t-issuer", method = "POST") =>
  world.handler!(new Request("https://edge.test", {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: "https://www.kretopia.com" },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  }));
const send = (over: Record<string, unknown> = {}, token: string | null = "t-issuer") => call({ invoiceId: ID, recipientEmail: "client@client.test", ...over }, token);
const providerCalls = () => world.fetch.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) }));
const logRows = (db: MemoryDb) => db.rows("email_send_log");
const invoiceStatus = (db: MemoryDb) => db.rows("invoices")[0].status;

beforeEach(() => {
  world.tokens = { "t-issuer": ISSUER, "t-stranger": "stranger-1" };
  world.env = { SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", RESEND_API_KEY: "re_test" };
  world.fetch.mockReset();
  world.fetch.mockResolvedValue(new Response(JSON.stringify({ id: "msg-1" }), { status: 200 }));
  vi.stubGlobal("fetch", world.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const refusedBeforeAnything = (db: CountingDb) => {
  expect(world.fetch).not.toHaveBeenCalled(); // the provider was never called
  expect(logRows(db)).toHaveLength(0); // nothing was recorded as sent
  expect(db.writes("invoices")).toHaveLength(0); // the invoice was not touched
};

describe("send-invoice-email: who may send", () => {
  it("sends the issuer's draft once, marks it sent, and records the send", async () => {
    const db = (world.db = seed()) as CountingDb;
    const res = await send();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, messageId: "msg-1" });
    expect(providerCalls()).toHaveLength(1);
    expect(providerCalls()[0].url).toBe("https://api.resend.com/emails");
    expect(providerCalls()[0].body).toMatchObject({ to: ["client@client.test"], from: "Kretopia <noreply@kretopia.com>" });
    expect(invoiceStatus(db)).toBe("sent");
    expect(logRows(db)).toHaveLength(1);
    expect(logRows(db)[0]).toMatchObject({ template_name: "invoice-direct", recipient_email: "client@client.test", metadata: { actor_user_id: ISSUER } });
  });

  it("accepts an external client who is not on the platform: an invoice to a new client is legitimate", async () => {
    world.db = seed();
    expect((await send({ recipientEmail: "someone@never-seen-before.example" })).status).toBe(200);
  });

  it("refuses a caller with no session or a session that does not verify, touching nothing", async () => {
    const db = (world.db = seed()) as CountingDb;
    expect((await send({}, null)).status).toBe(401);
    expect((await send({}, "forged")).status).toBe(401);
    refusedBeforeAnything(db);
  });

  it("answers another user's invoice exactly like a missing one", async () => {
    const db = (world.db = seed()) as CountingDb;
    const stranger = await send({}, "t-stranger");
    const missing = await send({ invoiceId: "00000000-0000-4000-8000-000000000000" });
    expect(stranger.status).toBe(404);
    expect(await stranger.json()).toEqual(await missing.json());
    refusedBeforeAnything(db);
  });

  it("refuses a method other than POST", async () => {
    const db = (world.db = seed()) as CountingDb;
    expect((await call(null, "t-issuer", "GET")).status).toBe(405);
    refusedBeforeAnything(db);
  });
});

describe("send-invoice-email: a settled invoice is never mailed again", () => {
  for (const status of ["paid", "cancelled"]) {
    it(`refuses a ${status} invoice and leaves it ${status}`, async () => {
      const db = (world.db = seed({ status })) as CountingDb;
      expect((await send()).status).toBe(409);
      refusedBeforeAnything(db);
      expect(invoiceStatus(db)).toBe(status);
    });
  }

  it("keeps an overdue or already sent invoice in its status after mailing it", async () => {
    for (const status of ["overdue", "sent", "accepted"]) {
      const db = (world.db = seed({ status })) as CountingDb;
      expect((await send()).status).toBe(200);
      expect(invoiceStatus(db)).toBe(status);
      expect(db.writes("invoices")).toHaveLength(0);
    }
  });

  it("does not mark an invoice sent when the provider refused the mail", async () => {
    const db = (world.db = seed()) as CountingDb;
    world.fetch.mockResolvedValue(new Response(JSON.stringify({ message: "domain not verified", account: "acct_secret" }), { status: 422 }));
    const res = await send();
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/acct_secret|domain not verified/);
    expect(invoiceStatus(db)).toBe("draft");
  });
});

describe("send-invoice-email: the recipient is bound to the invoice", () => {
  it("refuses a recipient other than the invoice's billed contact", async () => {
    world.db = seed();
    expect((await send({ recipientEmail: "someone@else.test" })).status).toBe(400);
    expect(world.fetch).not.toHaveBeenCalled();
  });
});

describe("send-invoice-email: the recipient is one plain address", () => {
  const bad = [
    "a@x.com, b@y.com",
    "a@x.com;b@y.com",
    "a@x.com\r\nBcc: victim@y.com",
    "<script>@x.com",
    '"quoted"@x.com',
    "no-at-sign",
    "",
    "   ",
    123,
    null,
    ["a@x.com", "b@y.com"],
    { email: "a@x.com" },
  ];
  for (const recipientEmail of bad) {
    it(`refuses ${JSON.stringify(recipientEmail)} before anything is sent`, async () => {
      const db = (world.db = seed()) as CountingDb;
      expect((await send({ recipientEmail })).status).toBe(400);
      refusedBeforeAnything(db);
    });
  }

  it("refuses an invoice id that is not a uuid", async () => {
    const db = (world.db = seed()) as CountingDb;
    for (const invoiceId of ["x", "", `${ID}' or '1'='1`, null, 5]) expect((await send({ invoiceId })).status).toBe(400);
    expect((await call("{not json")).status).toBe(400);
    expect((await call("x".repeat(20_000))).status).toBe(413);
    refusedBeforeAnything(db);
  });
});

describe("send-invoice-email: the mail carries no markup the issuer typed", () => {
  it("escapes every field in the HTML handed to the provider", async () => {
    const evil = '"><script>alert(1)</script><a href="https://evil.test">pay</a>';
    world.db = seed({ invoice_number: "A\r\nBcc: victim@y.com", brand_name: evil, recipient_name: evil, notes: evil, line_items: [{ description: evil, quantity: 1, rate: 1, amount: 1 }] });
    expect((await send()).status).toBe(200);
    const [{ body }] = providerCalls();
    expect(body.html).not.toContain("<script");
    expect(body.html).not.toContain('<a href="https://evil.test">');
    expect(body.subject).not.toMatch(/[\r\n]/);
    expect(body.html.match(/<a\b/g)).toHaveLength(1);
  });
});

describe("send-invoice-email: sending is bounded", () => {
  const hour = () => new Date(Date.now() - 60_000).toISOString();
  const prior = (n: number, over: Record<string, unknown> = {}) =>
    Array.from({ length: n }, (_, i) => ({ id: `log-${i}`, template_name: "invoice-direct", recipient_email: `r${i}@x.test`, status: "sent", created_at: hour(), metadata: { actor_user_id: ISSUER }, ...over }));

  it("refuses an issuer who already sent 30 in the hour", async () => {
    const db = (world.db = seed().seed("email_send_log", prior(30))) as CountingDb;
    expect((await send()).status).toBe(429);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(logRows(db)).toHaveLength(30);
    expect(invoiceStatus(db)).toBe("draft");
  });

  it("refuses an address already mailed 5 times in the hour, whoever sent them", async () => {
    const db = (world.db = seed().seed("email_send_log", prior(5, { recipient_email: "client@client.test", metadata: { actor_user_id: "another-issuer" } }))) as CountingDb;
    expect((await send()).status).toBe(429);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(logRows(db)).toHaveLength(5);
  });

  it("counts only this registry's rows: other templates do not use the invoice budget", async () => {
    world.db = seed().seed("email_send_log", prior(40, { template_name: "outreach-direct" }));
    expect((await send()).status).toBe(200);
  });

  it("fails closed when the registry cannot be read: nothing is sent", async () => {
    const db = (world.db = seed()) as CountingDb;
    db.hooks.failOn = (table, op) => (table === "email_send_log" && op === "select" ? { message: "down" } : null);
    expect((await send()).status).toBe(503);
    refusedBeforeAnything(db);
  });

  it("fails closed when the send cannot be recorded", async () => {
    const db = (world.db = seed()) as CountingDb;
    db.hooks.failOn = (table, op) => (table === "email_send_log" && op === "insert" ? { message: "down" } : null);
    expect((await send()).status).toBe(503);
    expect(world.fetch).not.toHaveBeenCalled();
    expect(invoiceStatus(db)).toBe("draft");
  });

  it("refuses, before recording anything, when the provider is not configured", async () => {
    const db = (world.db = seed()) as CountingDb;
    delete world.env.RESEND_API_KEY;
    expect((await send()).status).toBe(503);
    refusedBeforeAnything(db);
  });

  it("counts a send whose provider call failed: the attempt was spent", async () => {
    const db = (world.db = seed()) as CountingDb;
    world.fetch.mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await send()).status).toBe(502);
    expect(logRows(db)).toHaveLength(1);
  });
});
