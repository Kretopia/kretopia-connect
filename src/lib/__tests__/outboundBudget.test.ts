import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OUTREACH_PER_ACTOR_PER_HOUR,
  OUTREACH_PER_RECIPIENT_PER_HOUR,
  PROJECT_INVITES_PER_ACTOR_PER_HOUR,
  PROJECT_INVITES_PER_RECIPIENT_PER_HOUR,
  countActorSends,
  countRecipientSends,
  decideSendBudget,
  recordActorSend,
} from "../../../supabase/functions/_shared/outboundBudget";

// The jsdom test environment has no randomUUID; Deno (where this code runs) does.
if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

const limits = { actorLimit: 20, recipientLimit: 3 };

describe("decideSendBudget", () => {
  it("allows a send under both limits", () => {
    expect(decideSendBudget({ actorCount: 0, recipientCount: 0, ...limits })).toEqual({ ok: true });
    expect(decideSendBudget({ actorCount: 19, recipientCount: 2, ...limits })).toEqual({ ok: true });
  });

  it("refuses with 429 once the account has used its hour", () => {
    expect(decideSendBudget({ actorCount: 20, recipientCount: 0, ...limits })).toMatchObject({ ok: false, status: 429 });
    expect(decideSendBudget({ actorCount: 500, recipientCount: 0, ...limits })).toMatchObject({ ok: false, status: 429 });
  });

  it("refuses with 429 once this address was contacted too often, even by a fresh account", () => {
    expect(decideSendBudget({ actorCount: 0, recipientCount: 3, ...limits })).toMatchObject({ ok: false, status: 429 });
  });

  it("answers 503 and sends nothing when either count failed: unknown is not zero", () => {
    expect(decideSendBudget({ actorCount: null, recipientCount: 0, ...limits })).toMatchObject({ ok: false, status: 503 });
    expect(decideSendBudget({ actorCount: 0, recipientCount: null, ...limits })).toMatchObject({ ok: false, status: 503 });
  });

  it("keeps the documented limits", () => {
    expect(PROJECT_INVITES_PER_ACTOR_PER_HOUR).toBe(20);
    expect(PROJECT_INVITES_PER_RECIPIENT_PER_HOUR).toBe(3);
    expect(OUTREACH_PER_ACTOR_PER_HOUR).toBe(30);
    expect(OUTREACH_PER_RECIPIENT_PER_HOUR).toBe(3);
  });
});

// A stand-in for the service-role client: records the filters and the insert.
function fakeDb(opts: { count?: number | null; error?: boolean; insertError?: boolean } = {}) {
  const calls: { filters: Array<[string, unknown]>; inserted: unknown[] } = { filters: [], inserted: [] };
  const db = {
    from(table: string) {
      expect(table).toBe("email_send_log");
      const chain = {
        select: () => chain,
        eq: (k: string, v: unknown) => (calls.filters.push([k, v]), chain),
        in: (k: string, v: unknown) => (calls.filters.push([k, v]), chain),
        gte: (k: string, v: unknown) => (calls.filters.push([k, v]), chain),
        then: (resolveFn: (v: unknown) => unknown) =>
          resolveFn(opts.error ? { count: null, error: { message: "boom" } } : { count: opts.count ?? 0, error: null }),
        insert: async (row: unknown) => {
          calls.inserted.push(row);
          return { error: opts.insertError ? { message: "boom" } : null };
        },
      };
      return chain;
    },
  };
  return { db, calls };
}

describe("registry access", () => {
  it("counts an actor's sends by template, actor id and window", async () => {
    const { db, calls } = fakeDb({ count: 7 });
    expect(await countActorSends(db, "user-1", "outreach-direct", 60)).toBe(7);
    expect(calls.filters).toEqual(
      expect.arrayContaining([
        ["template_name", "outreach-direct"],
        ["metadata->>actor_user_id", "user-1"],
      ]),
    );
  });

  it("counts a recipient's sends by template and address", async () => {
    const { db, calls } = fakeDb({ count: 2 });
    expect(await countRecipientSends(db, "a@b.com", "outreach-direct")).toBe(2);
    expect(calls.filters).toEqual(expect.arrayContaining([["recipient_email", "a@b.com"]]));
  });

  it("returns null, never zero, when the count failed", async () => {
    expect(await countActorSends(fakeDb({ error: true }).db, "u", "t")).toBeNull();
    expect(await countRecipientSends(fakeDb({ error: true }).db, "a@b.com", "t")).toBeNull();
  });

  it("writes a row with the actor in metadata and a unique message id", async () => {
    const { db, calls } = fakeDb();
    expect(await recordActorSend(db, { template: "outreach-direct", actorId: "user-1", recipientEmail: "a@b.com", status: "sent" })).toBe(true);
    expect(await recordActorSend(db, { template: "outreach-direct", actorId: "user-1", recipientEmail: "a@b.com", status: "sent" })).toBe(true);
    const [first, second] = calls.inserted as Array<Record<string, unknown>>;
    expect(first).toMatchObject({
      template_name: "outreach-direct",
      recipient_email: "a@b.com",
      status: "sent",
      metadata: { actor_user_id: "user-1" },
    });
    expect(first.message_id).not.toBe(second.message_id);
  });

  it("reports a write that failed", async () => {
    expect(
      await recordActorSend(fakeDb({ insertError: true }).db, { template: "t", actorId: "u", recipientEmail: "a@b.com", status: "pending" }),
    ).toBe(false);
  });
});

describe("function wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("send-project-invitation: a validated address and accepted non-guest access before a link is minted, then a budget", () => {
    const source = read("send-project-invitation/index.ts");
    const access = source.indexOf("requireProjectAccess(admin, projectId, user.id, { allowRoles: INVITER_ROLES })");
    const budget = source.indexOf("decideSendBudget({");
    const mint = source.indexOf("admin.auth.admin.generateLink");
    expect(access).toBeGreaterThan(-1);
    expect(budget).toBeGreaterThan(access);
    expect(mint).toBeGreaterThan(budget);
    expect(source).toContain("cleanRecipientEmail(rawEmail)");
    expect(source).not.toContain('rpc("user_has_project_access"');
    expect(source).toMatch(/INVITER_ROLES: ProjectRole\[\] = \["owner", "collaborator", "creative", "client"\]/);
    expect(source).not.toMatch(/INVITER_ROLES[^\n]*"guest"/);
  });

  it("send-outreach-email: the budget is read before the platform send, only on that path", () => {
    const source = read("send-outreach-email/index.ts");
    const gmailReturn = source.indexOf("return sendViaGmail(");
    const budget = source.indexOf("decideSendBudget({");
    const resend = source.indexOf("return sendViaResend(");
    expect(gmailReturn).toBeGreaterThan(-1);
    expect(budget).toBeGreaterThan(gmailReturn);
    expect(resend).toBeGreaterThan(budget);
    expect(source).toContain("HttpStatusError(budget.status, budget.error)");
  });

  it("send-outreach-email: a sequence email is claimed before it leaves and released on failure", () => {
    const source = read("send-outreach-email/index.ts");
    const claim = source.indexOf('.in("status", ["pending", "failed"])');
    const send = source.indexOf("result = await sendEmail(to, subject, emailBody);");
    expect(claim).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(claim);
    expect(source).toContain('.eq("status", "pending")\n        .select("id");');
    expect(source.match(/update\(\{ status: "pending", sent_at: null \}\)/g)?.length).toBe(2);
    expect(source).toContain("status: e instanceof HttpStatusError ? e.status : 500");
  });

  it("send-event-blast: an explicit list is intersected with the event's participants", () => {
    const source = read("send-event-blast/index.ts");
    const audience = source.indexOf("const audience = new Set(");
    const explicit = source.indexOf("audience.has(x)");
    expect(audience).toBeGreaterThan(-1);
    expect(explicit).toBeGreaterThan(audience);
    expect(source).not.toContain('userIds = explicitUserIds.filter((x: any) => typeof x === "string");');
  });

  it("send-credit-invite: capped, one plain address each, clipped text", () => {
    const source = read("send-credit-invite/index.ts");
    expect(source).toContain("const MAX_COLLABORATORS = 20;");
    expect(source).toContain("cleanRecipientEmail(collab?.email)");
    expect(source).toContain("projectName: projectNameClean");
    expect(source).not.toContain("for (const collab of external_collaborators)");
  });
});
