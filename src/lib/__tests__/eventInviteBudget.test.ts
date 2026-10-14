import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVENT_INVITES_PER_ACTOR_PER_DAY,
  EVENT_INVITES_PER_RECIPIENT_PER_DAY,
  EVENT_INVITE_NOTE_MAX,
  EVENT_INVITE_TEMPLATE,
  EVENT_INVITE_WINDOW_MINUTES,
  countRecipientSendsBulk,
  planBulkSend,
  recordActorSendBatch,
} from "../../../supabase/functions/_shared/outboundBudget";

// The jsdom test environment has no randomUUID; Deno (where this code runs) does.
if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

const limits = { actorLimit: 500, recipientLimit: 3 };
const list = (n: number) => Array.from({ length: n }, (_, i) => `p${i}@example.com`);

describe("planBulkSend", () => {
  it("allows a whole list under both limits, in order", () => {
    const recipients = list(5);
    const plan = planBulkSend({ recipients, actorCount: 0, recipientCounts: {}, ...limits });
    expect(plan).toEqual({ ok: true, allowed: recipients, recentlyContacted: [], overAllowance: [] });
  });

  it("holds back an address mailed three times already, even for a fresh account", () => {
    const plan = planBulkSend({
      recipients: ["a@x.com", "b@x.com"],
      actorCount: 0,
      recipientCounts: { "a@x.com": 3, "b@x.com": 2 },
      ...limits,
    });
    expect(plan).toMatchObject({ ok: true, allowed: ["b@x.com"], recentlyContacted: ["a@x.com"], overAllowance: [] });
  });

  it("sends only what is left of the account's day, first addresses first", () => {
    const recipients = list(10);
    const plan = planBulkSend({ recipients, actorCount: 497, recipientCounts: {}, ...limits });
    expect(plan).toMatchObject({ ok: true, allowed: recipients.slice(0, 3), overAllowance: recipients.slice(3) });
  });

  it("refuses with 429 once the account has used its day, however short the list", () => {
    expect(planBulkSend({ recipients: ["a@x.com"], actorCount: 500, recipientCounts: {}, ...limits })).toMatchObject({ ok: false, status: 429 });
    expect(planBulkSend({ recipients: ["a@x.com"], actorCount: 9000, recipientCounts: {}, ...limits })).toMatchObject({ ok: false, status: 429 });
  });

  it("refuses with 429 when every address was contacted too recently", () => {
    const plan = planBulkSend({ recipients: ["a@x.com"], actorCount: 0, recipientCounts: { "a@x.com": 3 }, ...limits });
    expect(plan).toMatchObject({ ok: false, status: 429 });
  });

  it("answers 503 and sends nothing when a count could not be read: unknown is not zero", () => {
    expect(planBulkSend({ recipients: ["a@x.com"], actorCount: null, recipientCounts: {}, ...limits })).toMatchObject({ ok: false, status: 503 });
    expect(planBulkSend({ recipients: ["a@x.com"], actorCount: 0, recipientCounts: null, ...limits })).toMatchObject({ ok: false, status: 503 });
  });

  it("keeps the documented limits", () => {
    expect(EVENT_INVITES_PER_ACTOR_PER_DAY).toBe(500);
    expect(EVENT_INVITES_PER_RECIPIENT_PER_DAY).toBe(3);
    expect(EVENT_INVITE_WINDOW_MINUTES).toBe(1440);
    expect(EVENT_INVITE_NOTE_MAX).toBe(500);
    expect(EVENT_INVITE_TEMPLATE).toBe("event-invite-direct");
  });
});

// A stand-in for the service-role client.
function fakeDb(opts: { rows?: Array<{ recipient_email: string }>; error?: boolean; insertError?: boolean } = {}) {
  const calls = { queries: [] as Array<Array<[string, unknown]>>, inserted: [] as unknown[][] };
  const db = {
    from(table: string) {
      expect(table).toBe("email_send_log");
      const filters: Array<[string, unknown]> = [];
      calls.queries.push(filters);
      const chain = {
        select: () => chain,
        eq: (k: string, v: unknown) => (filters.push([k, v]), chain),
        in: (k: string, v: unknown) => (filters.push([k, v]), chain),
        gte: (k: string, v: unknown) => (filters.push([k, v]), chain),
        limit: () => chain,
        then: (resolveFn: (v: unknown) => unknown) =>
          resolveFn(opts.error ? { data: null, error: { message: "boom" } } : { data: opts.rows ?? [], error: null }),
        insert: async (rows: unknown[]) => {
          calls.inserted.push(rows);
          return { error: opts.insertError ? { message: "boom" } : null };
        },
      };
      return chain;
    },
  };
  return { db, calls };
}

describe("registry access for a list", () => {
  it("counts sends per address, in chunks of 100", async () => {
    const emails = list(250);
    const { db, calls } = fakeDb({ rows: [{ recipient_email: "p1@example.com" }, { recipient_email: "p1@example.com" }] });
    const counts = await countRecipientSendsBulk(db, emails, EVENT_INVITE_TEMPLATE, EVENT_INVITE_WINDOW_MINUTES);
    expect(calls.queries).toHaveLength(3);
    for (const filters of calls.queries) {
      expect(filters).toEqual(expect.arrayContaining([["template_name", EVENT_INVITE_TEMPLATE]]));
    }
    // The stand-in returns the same two rows for every chunk: 3 chunks x 2.
    expect(counts).toEqual({ "p1@example.com": 6 });
  });

  it("returns null, never an empty count, when a query failed", async () => {
    expect(await countRecipientSendsBulk(fakeDb({ error: true }).db, list(3), "t")).toBeNull();
  });

  it("writes one row per address in one insert, with the actor and unique message ids", async () => {
    const { db, calls } = fakeDb();
    const ok = await recordActorSendBatch(db, {
      template: EVENT_INVITE_TEMPLATE,
      actorId: "host-1",
      recipientEmails: ["a@x.com", "b@x.com"],
      status: "pending",
    });
    expect(ok).toBe(true);
    expect(calls.inserted).toHaveLength(1);
    const [a, b] = calls.inserted[0] as Array<Record<string, unknown>>;
    expect(a).toMatchObject({ template_name: EVENT_INVITE_TEMPLATE, recipient_email: "a@x.com", status: "pending", metadata: { actor_user_id: "host-1" } });
    expect(b).toMatchObject({ recipient_email: "b@x.com" });
    expect(a.message_id).not.toBe(b.message_id);
  });

  it("writes nothing for an empty list and reports a failed write", async () => {
    const empty = fakeDb();
    expect(await recordActorSendBatch(empty.db, { template: "t", actorId: "u", recipientEmails: [], status: "pending" })).toBe(true);
    expect(empty.calls.inserted).toHaveLength(0);
    expect(
      await recordActorSendBatch(fakeDb({ insertError: true }).db, { template: "t", actorId: "u", recipientEmails: ["a@x.com"], status: "pending" }),
    ).toBe(false);
  });
});

describe("send-event-invite wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/send-event-invite/index.ts"), "utf8");

  it("checks the host owns the event before it reads any count", () => {
    const owner = source.indexOf("ev.created_by !== user.id");
    const counts = source.indexOf("countActorSends(");
    expect(owner).toBeGreaterThan(-1);
    expect(counts).toBeGreaterThan(owner);
  });

  it("reads the budget, then records the sends, then sends, and only to the allowed addresses", () => {
    const counts = source.indexOf("countRecipientSendsBulk(");
    const plan = source.indexOf("planBulkSend({");
    const record = source.indexOf("recordActorSendBatch(");
    const send = source.indexOf('"send-transactional-email"');
    expect(counts).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(counts);
    expect(record).toBeGreaterThan(plan);
    expect(send).toBeGreaterThan(record);
    expect(source).toContain("for (const email of plan.allowed)");
    expect(source).not.toContain("for (const email of cleaned)");
  });

  it("refuses with the plan's status and does not send when the registry write failed", () => {
    expect(source).toContain("status: plan.status");
    expect(source).toMatch(/if \(!recorded\)[\s\S]{0,200}status: 503/);
  });

  it("validates every address as a single plain address and clips the free text", () => {
    expect(source).toContain("cleanRecipientEmail(e)");
    expect(source).not.toContain("const EMAIL_RE");
    expect(source).toContain("cleanFreeText(personalNote, EVENT_INVITE_NOTE_MAX)");
    expect(source).toContain("personalNote: note || undefined");
    expect(source).not.toContain("personalNote?.trim()");
  });

  it("puts only a username-shaped ref in the link", () => {
    expect(source).toContain("REF_RE.test(suppliedRef)");
    expect(source).toContain("const REF_RE = /^[A-Za-z0-9_.-]{1,40}$/");
  });

  it("reports what was held back", () => {
    expect(source).toContain("skipped:");
    expect(source).toContain("skipped_recently_contacted");
    expect(source).toContain("skipped_over_limit");
  });
});
