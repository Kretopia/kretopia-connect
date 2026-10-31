import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INVOICE_CHASE_COOLDOWN_MS,
  SESSION_CANCEL_COOLDOWN_MS,
  SESSION_CHANGES_MAX_ITEMS,
  SESSION_CHANGE_ITEM_MAX,
  SESSION_PING_COOLDOWN_MS,
  SESSION_REASON_MAX,
  SESSION_UPDATE_COOLDOWN_MS,
  SWIPE_NOTIFY_PER_ACTOR_PER_HOUR,
  SWIPE_NOTIFY_TEMPLATE,
  claimNotificationOnce,
  cleanSessionChanges,
  cleanSessionReason,
  cooldownCutoffIso,
  countRecentSessionNotifications,
  decideCooldown,
  decideInvoiceChase,
  releaseNotificationClaim,
  swipeNotifyMessageId,
} from "../../../supabase/functions/_shared/notificationGuards";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("session text", () => {
  it("keeps a reason that is a string, clipped, without control characters", () => {
    expect(cleanSessionReason("  We moved the room.  ")).toBe("We moved the room.");
    expect(cleanSessionReason("a\u0000b\u0007c")).toBe("abc");
    expect(cleanSessionReason("x".repeat(2000))).toHaveLength(SESSION_REASON_MAX);
  });

  it("refuses a reason that is not a string, or is empty", () => {
    expect(cleanSessionReason({ toString: () => "evil" })).toBeNull();
    expect(cleanSessionReason(["a"])).toBeNull();
    expect(cleanSessionReason(42)).toBeNull();
    expect(cleanSessionReason("   ")).toBeNull();
    expect(cleanSessionReason(undefined)).toBeNull();
  });

  it("keeps a short list of short strings and drops everything else", () => {
    expect(cleanSessionChanges(["time", " room "])).toEqual(["time", "room"]);
    expect(cleanSessionChanges("time, room")).toEqual([]);
    expect(cleanSessionChanges({ 0: "a" })).toEqual([]);
    expect(cleanSessionChanges([1, null, {}, "ok", ""])).toEqual(["ok"]);
    const long = cleanSessionChanges(["y".repeat(500)]);
    expect(long[0]).toHaveLength(SESSION_CHANGE_ITEM_MAX);
    expect(cleanSessionChanges(Array.from({ length: 50 }, (_, i) => `c${i}`))).toHaveLength(SESSION_CHANGES_MAX_ITEMS);
  });
});

describe("cooldown", () => {
  it("allows when nothing was sent in the window", () => {
    expect(decideCooldown(0, "wait")).toEqual({ ok: true });
  });
  it("refuses with 429 when the same notice went out in the window", () => {
    expect(decideCooldown(1, "wait")).toEqual({ ok: false, status: 429, error: "wait" });
    expect(decideCooldown(40, "wait")).toMatchObject({ ok: false, status: 429 });
  });
  it("answers 503 when the count could not be read: unknown is not zero", () => {
    expect(decideCooldown(null, "wait")).toMatchObject({ ok: false, status: 503 });
  });
  it("computes the window start", () => {
    expect(cooldownCutoffIso(NOW, SESSION_PING_COOLDOWN_MS)).toBe(new Date(NOW - 120_000).toISOString());
  });
  it("keeps the documented windows", () => {
    expect(SESSION_PING_COOLDOWN_MS).toBe(120_000);
    expect(SESSION_UPDATE_COOLDOWN_MS).toBe(120_000);
    expect(SESSION_CANCEL_COOLDOWN_MS).toBe(3_600_000);
    expect(INVOICE_CHASE_COOLDOWN_MS).toBe(86_400_000);
    expect(SWIPE_NOTIFY_PER_ACTOR_PER_HOUR).toBe(60);
  });
});

describe("decideInvoiceChase", () => {
  it("allows an issued, unpaid invoice that was never reminded", () => {
    expect(decideInvoiceChase({ status: "overdue", reminder_sent_at: null }, true, NOW)).toEqual({ ok: true });
    expect(decideInvoiceChase({ status: "sent" }, true, NOW)).toEqual({ ok: true });
  });

  it("refuses a paid or cancelled invoice, drafting or sending", () => {
    for (const send of [true, false]) {
      expect(decideInvoiceChase({ status: "paid" }, send, NOW)).toMatchObject({ ok: false, status: 409, reason: "settled" });
      expect(decideInvoiceChase({ status: "cancelled" }, send, NOW)).toMatchObject({ ok: false, reason: "settled" });
      expect(decideInvoiceChase({ status: " PAID " }, send, NOW)).toMatchObject({ ok: false, reason: "settled" });
    }
  });

  it("refuses an invoice with a paid date even if its status was not updated", () => {
    expect(decideInvoiceChase({ status: "sent", paid_at: hoursAgo(5) }, true, NOW)).toMatchObject({ ok: false, reason: "settled" });
  });

  it("does not send a reminder for a draft, but lets its text be drafted", () => {
    expect(decideInvoiceChase({ status: "draft" }, true, NOW)).toMatchObject({ ok: false, reason: "not_issued" });
    expect(decideInvoiceChase({ status: "draft" }, false, NOW)).toEqual({ ok: true });
  });

  it("does not repeat a reminder inside 24 hours, and does after", () => {
    expect(decideInvoiceChase({ status: "overdue", reminder_sent_at: hoursAgo(23) }, true, NOW)).toMatchObject({
      ok: false,
      reason: "reminder_recent",
    });
    expect(decideInvoiceChase({ status: "overdue", reminder_sent_at: hoursAgo(25) }, true, NOW)).toEqual({ ok: true });
  });

  it("does not hold back a draft of the text because a reminder was recent", () => {
    expect(decideInvoiceChase({ status: "overdue", reminder_sent_at: hoursAgo(1) }, false, NOW)).toEqual({ ok: true });
  });

  it("treats an unreadable reminder date as never reminded rather than as a refusal", () => {
    expect(decideInvoiceChase({ status: "overdue", reminder_sent_at: "not a date" }, true, NOW)).toEqual({ ok: true });
  });
});

// A stand-in for the service-role client.
function fakeDb(opts: { insertError?: { code?: string } | null; count?: number | null; countError?: boolean } = {}) {
  const calls = {
    inserted: [] as Array<Record<string, unknown>>,
    updates: [] as Array<{ patch: unknown; filters: Array<[string, unknown]> }>,
    filters: [] as Array<[string, unknown]>,
  };
  const db = {
    from(_table: string) {
      const filters: Array<[string, unknown]> = [];
      const chain = {
        insert: async (row: Record<string, unknown>) => {
          calls.inserted.push(row);
          return { error: opts.insertError ?? null };
        },
        update: (patch: unknown) => {
          calls.updates.push({ patch, filters });
          return chain;
        },
        select: () => chain,
        eq: (k: string, v: unknown) => (filters.push([k, v]), calls.filters.push([k, v]), chain),
        gte: (k: string, v: unknown) => (filters.push([k, v]), calls.filters.push([k, v]), chain),
        then: (resolveFn: (v: unknown) => unknown) =>
          resolveFn(opts.countError ? { count: null, error: { message: "boom" } } : { count: opts.count ?? 0, error: null }),
      };
      return chain;
    },
  };
  return { db, calls };
}

describe("claimNotificationOnce", () => {
  const row = {
    messageId: swipeNotifyMessageId("swiper-1", "target-1"),
    template: SWIPE_NOTIFY_TEMPLATE,
    actorId: "swiper-1",
    recipientEmail: "t@example.com",
  };

  it("claims a notification that has not gone out, written as a 'sent' row with the actor", async () => {
    const { db, calls } = fakeDb();
    expect(await claimNotificationOnce(db, row)).toBe("claimed");
    expect(calls.inserted[0]).toMatchObject({
      message_id: "swipe-notify:swiper-1:target-1",
      template_name: "swipe-notify",
      recipient_email: "t@example.com",
      status: "sent",
      metadata: { actor_user_id: "swiper-1" },
    });
  });

  it("reports a repeat of the same pair as a duplicate (the unique violation), not as a failure", async () => {
    expect(await claimNotificationOnce(fakeDb({ insertError: { code: "23505" } }).db, row)).toBe("duplicate");
  });

  it("reports any other failure as an error, so nothing is sent", async () => {
    expect(await claimNotificationOnce(fakeDb({ insertError: { code: "42501" } }).db, row)).toBe("error");
    expect(await claimNotificationOnce(fakeDb({ insertError: {} }).db, row)).toBe("error");
  });

  it("builds the id from both people, in order", () => {
    expect(swipeNotifyMessageId("a", "b")).not.toBe(swipeNotifyMessageId("b", "a"));
  });

  it("releases only a 'sent' claim of that message, as failed", async () => {
    const { db, calls } = fakeDb();
    await releaseNotificationClaim(db, "swipe-notify:swiper-1:target-1");
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].patch).toMatchObject({ status: "failed" });
    expect(calls.updates[0].filters).toEqual(
      expect.arrayContaining([
        ["message_id", "swipe-notify:swiper-1:target-1"],
        ["status", "sent"],
      ]),
    );
  });
});

describe("countRecentSessionNotifications", () => {
  it("counts by type, session link and window", async () => {
    const { db, calls } = fakeDb({ count: 2 });
    const n = await countRecentSessionNotifications(db, { type: "speed_session_ping", actionUrl: "/circle/speed/s1", sinceIso: "2026-10-15T11:58:00Z" });
    expect(n).toBe(2);
    expect(calls.filters).toEqual(
      expect.arrayContaining([
        ["type", "speed_session_ping"],
        ["action_url", "/circle/speed/s1"],
        ["created_at", "2026-10-15T11:58:00Z"],
      ]),
    );
  });
  it("returns null, never zero, when the count failed", async () => {
    expect(await countRecentSessionNotifications(fakeDb({ countError: true }).db, { type: "t", actionUrl: "/x", sinceIso: "z" })).toBeNull();
  });
});

describe("function wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("notify-swipe: the real swipe is proven, then the hourly count, then the once-claim, then any send", () => {
    const s = read("notify-swipe/index.ts");
    const swipe = s.indexOf('"No matching swipe found"');
    const count = s.indexOf("countActorSends(supabaseClient, swiperId, SWIPE_NOTIFY_TEMPLATE, 60)");
    const claim = s.indexOf("claimNotificationOnce(supabaseClient");
    const email = s.indexOf("'send-notification-email'");
    const push = s.indexOf("'send-push-notification'");
    expect(swipe).toBeGreaterThan(-1);
    expect(count).toBeGreaterThan(swipe);
    expect(claim).toBeGreaterThan(count);
    expect(email).toBeGreaterThan(claim);
    expect(push).toBeGreaterThan(claim);
    expect(s).toContain('claim === "duplicate"');
    expect(s).toContain('claim === "error"');
    expect(s).toMatch(/swipesLastHour === null[\s\S]{0,200}status: 503/);
    expect(s).toMatch(/swipesLastHour >= SWIPE_NOTIFY_PER_ACTOR_PER_HOUR[\s\S]{0,200}status: 429/);
    expect(s).toContain("releaseNotificationClaim(supabaseClient, claimId)");
  });

  it("notify-speed-pool-ping: host or admin first, then the cooldown, then the insert", () => {
    const s = read("notify-speed-pool-ping/index.ts");
    const host = s.indexOf('"forbidden"');
    const cooldown = s.indexOf("decideCooldown(recent");
    const insert = s.indexOf('.from("notifications").insert(rows)');
    expect(host).toBeGreaterThan(-1);
    expect(cooldown).toBeGreaterThan(host);
    expect(insert).toBeGreaterThan(cooldown);
    expect(s).toContain("SESSION_PING_COOLDOWN_MS");
    expect(s).toContain("status: cooldown.status");
  });

  it("notify-speed-session-update: host or admin first, text cleaned, cooldown, then the insert", () => {
    const s = read("notify-speed-session-update/index.ts");
    const host = s.indexOf('"forbidden"');
    const clean = s.indexOf("cleanSessionReason(rawReason)");
    const cooldown = s.indexOf("decideCooldown(recent");
    const insert = s.indexOf('.from("notifications").insert(rows)');
    expect(host).toBeGreaterThan(-1);
    expect(clean).toBeGreaterThan(host);
    expect(cooldown).toBeGreaterThan(clean);
    expect(insert).toBeGreaterThan(cooldown);
    expect(s).toContain("cleanSessionChanges(rawChanges)");
    expect(s).toContain("SESSION_CANCEL_COOLDOWN_MS");
    expect(s).not.toContain("changes = []");
  });

  it("send-invoice-chase: ownership, the gate before the AI call, approved only at hand-off, outcome reported", () => {
    const s = read("send-invoice-chase/index.ts");
    const owner = s.indexOf('.eq("issued_by", userId)');
    const gate = s.indexOf("decideInvoiceChase(invoice, send, Date.now())");
    const ai = s.indexOf("https://ai.gateway.lovable.dev");
    const approve = s.indexOf('.update({ status: "approved" })');
    const handoff = s.indexOf("/functions/v1/send-outreach-draft");
    expect(owner).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(owner);
    expect(ai).toBeGreaterThan(gate);
    expect(approve).toBeGreaterThan(ai);
    expect(handoff).toBeGreaterThan(approve);
    // The draft is saved as a draft; a failed hand-off puts it back and says why.
    expect(s).toMatch(/status: "draft",\s*\n\s*meta: \{ invoice_id/);
    expect(s).toContain('.update({ status: "draft" })');
    expect(s).toContain("send_error: sendError");
    expect(s).toMatch(/return json\(\{ ok: true, draft, sent, send_error/);
    // The reminder date is no longer written here: send-outreach-draft is the one place it is.
    expect(s).not.toContain("reminder_sent_at");
  });

  it("send-outreach-draft: a reminder's invoice is checked before the recipient and Gmail, claimed before 'sending', released on failure", () => {
    const s = read("send-outreach-draft/index.ts");
    const alreadySent = s.indexOf('if (draft.status === "sent")');
    const source = s.indexOf('draft.source === "chase_invoice"');
    const owner = s.indexOf('.eq("issued_by", userId)');
    const gate = s.indexOf("decideInvoiceChase(inv, true, Date.now())");
    const gmail = s.indexOf('.from("user_email_settings")');
    const claim = s.indexOf(".or(`reminder_sent_at.is.null,reminder_sent_at.lt.${cutoff}`)");
    const sending = s.indexOf('status: "sending"');
    const smtp = s.indexOf("new SMTPClient(");
    const release = s.indexOf("releaseInvoiceClaim?.()");
    expect(alreadySent).toBeGreaterThan(-1);
    expect(source).toBeGreaterThan(alreadySent);
    expect(owner).toBeGreaterThan(source);
    expect(gate).toBeGreaterThan(owner);
    expect(gmail).toBeGreaterThan(gate);
    expect(claim).toBeGreaterThan(gmail);
    expect(sending).toBeGreaterThan(claim);
    expect(smtp).toBeGreaterThan(sending);
    expect(release).toBeGreaterThan(smtp);
    expect(s).toMatch(/Could not check the invoice[\s\S]{0,80}503/);
    expect(s).toContain('reason: "reminder_recent"');
    expect(s).toContain("{ error: gate.error, reason: gate.reason }, gate.status");
    // Only a reminder is affected.
    expect(s).toMatch(/draft\.source === "chase_invoice" && typeof draft\.meta\?\.invoice_id === "string"/);
  });
});

describe("notification senders: no forged-JWT authorization", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("send-notification-email never trusts decoded claims: service key is compared constant-time, users are verified", () => {
    const s = read("send-notification-email/index.ts");
    // The bypass: parseJwtClaims decoded role/sub/email without signature
    // verification, so a self-minted JWT with role=service_role authorized sends.
    expect(s).not.toContain("parseJwtClaims");
    expect(s).toContain("constantTimeEqual(token, serviceKey)");
    expect(s).toContain("auth.getUser(token)");
    // Self-service and admin checks must use the verified identity.
    expect(s).toContain("caller.id");
    expect(s).toContain("caller.email");
    expect(s).not.toMatch(/claims\?\.(role|sub|email)/);
  });

  it("send-push-notification never trusts decoded claims: service key is compared constant-time, users are verified", () => {
    const s = read("send-push-notification/index.ts");
    expect(s).not.toContain("parseJwtClaims");
    expect(s).not.toContain("parseCallerClaims");
    expect(s).toContain("constantTimeEqual(token, serviceKey)");
    expect(s).toContain("auth.getUser(token)");
    // Relationship checks run against the verified caller id.
    expect(s).toContain("hasRealRelationship(supabaseClient, caller.id, payload.userId)");
    expect(s).not.toMatch(/claims\?\.(role|sub)/);
  });
});
