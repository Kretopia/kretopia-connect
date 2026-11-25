// A paid Stage ticket gets one confirmation email when the Stripe webhook first seats the buyer: the ticket form of the Stage
// registration email, as the service, with the amount Stripe reported. A retried webhook (seat already there) sends nothing,
// an email failure never undoes the seat, and a session that seats nobody sends nothing.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
import { finalizeStageTicket } from "../../../../supabase/functions/_shared/stageCircleActivation";
import { formatTicketAmount, stageRegistrationTemplateData } from "../../../../supabase/functions/_shared/stageRegistrationEmail";

const STAGE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
const emails: Array<{ url: string; auth: string | null; body: { idempotencyKey: string; templateData: Record<string, unknown> } & Record<string, unknown> }> = [];
let emailStatus = 200;
let db: MemoryDb;

const admin = () => ({
  from: (t: string) => db.from(t),
  auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: "fan@example.com" } } }) } },
});
const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_1", payment_status: "paid", amount_total: 1200, currency: "eur",
  metadata: { kind: "curated_stage", stage_id: STAGE, user_id: "fan-1", entry_checked: "1" }, ...over,
});

beforeAll(() => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  // Deno has AbortSignal.timeout; jsdom does not.
  if (typeof AbortSignal.timeout !== "function") (AbortSignal as unknown as { timeout: () => AbortSignal }).timeout = () => new AbortController().signal;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    emails.push({ url: String(url), auth: new Headers(init.headers).get("Authorization"), body: JSON.parse(String(init.body)) });
    return new Response("{}", { status: emailStatus });
  }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  db = new MemoryDb()
    .seed("curated_stages", [{ id: STAGE, title: "Night Shoot Showcase", starts_at: "2026-12-17T20:00:00Z", ends_at: null, visibility: "public", invite_token: null, host_user_id: "host-1", is_paid: true }])
    .seed("curated_stage_orders", [{ id: "order-1", stage_id: STAGE, user_id: "fan-1", stripe_session_id: "cs_test_1", status: "pending" }])
    .seed("profiles", [{ user_id: "host-1", full_name: "Ana Lima" }, { user_id: "fan-1", full_name: "Dee" }]);
  emails.length = 0;
  emailStatus = 200;
});

describe("paid Stage ticket confirmation", () => {
  it("the webhook that seats the buyer queues one ticket email, as the service, with what was paid", async () => {
    expect(await finalizeStageTicket(admin(), session())).toBe("paid");
    expect(db.rows("curated_stage_rsvps")).toEqual([expect.objectContaining({ user_id: "fan-1", status: "rsvp", ticket_order_id: "order-1" })]);
    expect(emails).toHaveLength(1);
    expect(emails[0].url).toBe("https://legacy.test/functions/v1/send-transactional-email");
    expect(emails[0].auth).toBe("Bearer service-key");
    expect(emails[0].body).toMatchObject({
      templateName: "curated-stage-registration-confirmation",
      recipientUserId: "fan-1",
      idempotencyKey: `stage-ticket:${STAGE}:fan-1`,
      templateData: { ticket: true, paidAmount: "12.00 EUR", status: "rsvp", stageTitle: "Night Shoot Showcase", hostName: "Ana Lima", attendeeName: "Dee", startsWhen: "Thu 17 Dec 2026, 20:00 UTC" },
    });
  });

  it("a retried webhook (the seat is already there) sends nothing more", async () => {
    await finalizeStageTicket(admin(), session());
    await finalizeStageTicket(admin(), session());
    expect(emails).toHaveLength(1);
  });

  it("a buyer moving up from the waitlist gets the ticket email", async () => {
    db.seed("curated_stage_rsvps", [{ stage_id: STAGE, user_id: "fan-1", status: "waitlist" }]);
    await finalizeStageTicket(admin(), session());
    expect(emails).toHaveLength(1);
  });

  it("a failed email never undoes the seat", async () => {
    emailStatus = 500;
    expect(await finalizeStageTicket(admin(), session())).toBe("paid");
    expect(db.rows("curated_stage_rsvps")).toHaveLength(1);
  });

  it("an unpaid session, or a private Stage the buyer may not enter, seats nobody and sends nothing", async () => {
    expect(await finalizeStageTicket(admin(), session({ payment_status: "unpaid" }))).toBe("skipped");
    await db.from("curated_stages").update({ visibility: "private", invite_token: "door" }).eq("id", STAGE);
    expect(await finalizeStageTicket(admin(), session({ metadata: { kind: "curated_stage", stage_id: STAGE, user_id: "fan-1" } }))).toBe("invite_required");
    expect(db.rows("curated_stage_rsvps")).toHaveLength(0);
    expect(emails).toHaveLength(0);
  });
});

describe("ticket email data", () => {
  it("shows a paid amount only when Stripe reported a usable one", () => {
    expect(formatTicketAmount({ amountCents: 1200, currency: "eur" })).toBe("12.00 EUR");
    expect(formatTicketAmount({ amountCents: 0, currency: "eur" })).toBeNull();
    expect(formatTicketAmount({ amountCents: 1200, currency: null })).toBeNull();
    expect(formatTicketAmount(null)).toBeNull();
    const base = { id: STAGE, title: "T", starts_at: "2026-12-17T20:00:00Z" };
    expect(stageRegistrationTemplateData({ stage: base, status: "rsvp", ticket: { amountCents: null } })).toMatchObject({ ticket: true });
    expect(stageRegistrationTemplateData({ stage: base, status: "rsvp", ticket: { amountCents: null } })).not.toHaveProperty("paidAmount");
    expect(stageRegistrationTemplateData({ stage: base, status: "rsvp" })).not.toHaveProperty("ticket");
  });
});
