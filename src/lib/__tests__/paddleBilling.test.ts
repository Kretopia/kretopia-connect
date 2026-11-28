/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles for a query builder and untyped provider payloads */
import { describe, expect, it, vi } from "vitest";
import { buildPaddleSignatureHeader, signCheckoutBinding, verifyCheckoutBinding, verifyPaddleSignature } from "../../../supabase/functions/_shared/paddleSignature";
import { assertPaddleEnv, billingProvider, checkPaddleEnv, paddlePrices, priceEnvName, providerForUser, PAID_TIERS, INTERVALS } from "../../../supabase/functions/_shared/paddleEnv";
import { decidePaddleEntitlement, type CurrentBilling, type PaddleEvent } from "../../../supabase/functions/_shared/paddleEntitlements";
import { handlePaddleWebhook } from "../../../supabase/functions/_shared/paddleWebhook";
import { CheckoutRefusal, createPaddleCheckout } from "../../../supabase/functions/_shared/paddleCheckout";
import { createPortalSession, createTransaction } from "../../../supabase/functions/_shared/paddleApi";

// Fixtures only: no Paddle account, no network, no real key.
const SECRET = "pdl_ntfset_fixture_primary_00000000";
const USER = "11111111-2222-3333-4444-555555555555";
const SUB = "sub_01fixture000000000000000001";
const PRICE_PRO = "pri_01fixturepro00000000000001";
const PRICE_CP = "pri_01fixturecreatorpro0000001";
const NOW = 1_800_000_000;

const ENV: Record<string, string> = {
  BILLING_PROVIDER: "paddle",
  PADDLE_ENV: "sandbox",
  PADDLE_API_KEY: "pdl_sdbx_apikey_fixture",
  PADDLE_WEBHOOK_SECRET: SECRET,
  PADDLE_CLIENT_TOKEN: "test_fixture_client_token",
};
PAID_TIERS.forEach((tier, i) => INTERVALS.forEach((interval, j) => { ENV[priceEnvName(tier, interval)] = `pri_01fixture${tier.replace("_", "")}${interval}${i}${j}`.padEnd(30, "0"); }));
ENV[priceEnvName("pro", "monthly")] = PRICE_PRO;
ENV[priceEnvName("creator_pro", "monthly")] = PRICE_CP;
const prices = paddlePrices(ENV);

const iso = (offsetSeconds: number) => new Date((NOW + offsetSeconds) * 1000).toISOString();
const sub = (over: Partial<PaddleEvent> & { data?: Record<string, any> } = {}): PaddleEvent => ({
  event_id: "evt_01fixture0001",
  event_type: "subscription.created",
  occurred_at: iso(0),
  ...over,
  data: {
    id: SUB, status: "active", customer_id: "ctm_01fixture", items: [{ price: { id: PRICE_PRO, product_id: "pro_01fixture" } }],
    current_billing_period: { ends_at: iso(86_400 * 30) }, scheduled_change: null, ...over.data,
  },
});
const none: CurrentBilling = { tier: "free", status: "none", provider: null, paddleSubscriptionId: null, eventAt: null, hasStripeCustomer: false };

describe("Paddle signature", () => {
  const body = JSON.stringify({ event_id: "evt_1", event_type: "subscription.created", occurred_at: iso(0), data: {} });
  it("accepts a valid signature on the raw body", async () => {
    const header = await buildPaddleSignatureHeader(body, SECRET, NOW);
    expect((await verifyPaddleSignature(body, header, SECRET, 300, NOW)).ok).toBe(true);
  });
  it("rejects missing, malformed, tampered, wrong-secret, stale and empty-secret requests", async () => {
    const header = await buildPaddleSignatureHeader(body, SECRET, NOW);
    expect(await verifyPaddleSignature(body, null, SECRET, 300, NOW)).toEqual({ ok: false, reason: "missing_signature_header" });
    expect(await verifyPaddleSignature(body, "nonsense", SECRET, 300, NOW)).toEqual({ ok: false, reason: "malformed_signature_header" });
    expect(await verifyPaddleSignature(`${body} `, header, SECRET, 300, NOW)).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(await verifyPaddleSignature(body, header, "other", 300, NOW)).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(await verifyPaddleSignature(body, header, "", 300, NOW)).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(await verifyPaddleSignature(body, header, SECRET, 300, NOW + 301)).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
  });
  it("accepts either h1 while a secret is rotated", async () => {
    const good = await buildPaddleSignatureHeader(body, SECRET, NOW);
    const rotated = `${good};h1=${"0".repeat(64)}`;
    expect((await verifyPaddleSignature(body, rotated, SECRET, 300, NOW)).ok).toBe(true);
  });
  it("binds a user id to the server: a forged or foreign tag is refused", async () => {
    const tag = await signCheckoutBinding(USER, SECRET);
    expect(await verifyCheckoutBinding(USER, tag, SECRET)).toBe(true);
    expect(await verifyCheckoutBinding("99999999-2222-3333-4444-555555555555", tag, SECRET)).toBe(false);
    expect(await verifyCheckoutBinding(USER, "0".repeat(64), SECRET)).toBe(false);
    expect(await verifyCheckoutBinding(USER, undefined, SECRET)).toBe(false);
  });
});

describe("Paddle environment consistency", () => {
  it("accepts a consistent sandbox configuration", () => {
    expect(checkPaddleEnv(ENV, { apiKey: true, webhookSecret: true, clientToken: true, prices: true })).toMatchObject({ ok: true, environment: "sandbox" });
  });
  it("refuses a live key, token under PADDLE_ENV=sandbox and reports every problem without printing values", () => {
    const bad = { ...ENV, PADDLE_API_KEY: "pdl_live_apikey_SECRETVALUE", PADDLE_CLIENT_TOKEN: "live_SECRETTOKEN" };
    const report = checkPaddleEnv(bad, { apiKey: true, clientToken: true });
    expect(report.ok).toBe(false);
    expect(report.errors).toHaveLength(2);
    expect(JSON.stringify(report)).not.toMatch(/SECRETVALUE|SECRETTOKEN/);
    expect(() => assertPaddleEnv(bad, { apiKey: true })).toThrow(/live key but PADDLE_ENV=sandbox/);
  });
  it("refuses a missing or invalid PADDLE_ENV, missing prices and a malformed price id", () => {
    expect(checkPaddleEnv({}, {}).ok).toBe(false);
    expect(checkPaddleEnv({ ...ENV, PADDLE_ENV: "prod" }, {}).ok).toBe(false);
    expect(checkPaddleEnv({ ...ENV, [priceEnvName("pro", "yearly")]: "price_stripe_style" }, { prices: true }).errors.join()).toMatch(/PADDLE_PRICE_PRO_YEARLY is not a Paddle price id/);
    const { [priceEnvName("pro", "monthly")]: _drop, ...missing } = ENV;
    expect(checkPaddleEnv(missing, { prices: true }).errors.join()).toMatch(/PADDLE_PRICE_PRO_MONTHLY is not set/);
  });
  it("keeps Stripe the default provider and rejects an unknown one", () => {
    expect(billingProvider({})).toBe("stripe");
    expect(billingProvider({ BILLING_PROVIDER: " Paddle " })).toBe("paddle");
    expect(() => billingProvider({ BILLING_PROVIDER: "other" })).toThrow();
  });
});

describe("who gets Paddle checkout", () => {
  const tester = "aaaaaaaa-1111-2222-3333-444444444444";
  const other = "bbbbbbbb-1111-2222-3333-444444444444";
  it("is Stripe for everyone unless BILLING_PROVIDER=paddle", () => {
    expect(providerForUser({}, tester)).toBe("stripe");
    expect(providerForUser({ BILLING_PROVIDER: "stripe", PADDLE_ALLOWED_USER_IDS: tester }, tester)).toBe("stripe");
  });
  it("is Paddle for everyone when no tester list is set", () => {
    expect(providerForUser({ BILLING_PROVIDER: "paddle" }, other)).toBe("paddle");
    expect(providerForUser({ BILLING_PROVIDER: "paddle", PADDLE_ALLOWED_USER_IDS: " , " }, other)).toBe("paddle");
  });
  it("limits Paddle to the listed testers (case and spaces ignored) and keeps everyone else on Stripe", () => {
    const env = { BILLING_PROVIDER: "paddle", PADDLE_ALLOWED_USER_IDS: ` ${tester.toUpperCase()} , cccccccc-1 ` };
    expect(providerForUser(env, tester)).toBe("paddle");
    expect(providerForUser(env, other)).toBe("stripe");
  });
});

describe("entitlements change only from verified, ordered subscription facts", () => {
  it("grants the tier the PRICE maps to (never a client-supplied tier) when the subscription is active", () => {
    const d = decidePaddleEntitlement(sub(), none, prices);
    expect(d).toMatchObject({ kind: "apply", patch: { subscription_tier: "pro", subscription_status: "active", subscription_provider: "paddle", paddle_subscription_id: SUB } });
    const cp = decidePaddleEntitlement(sub({ data: { items: [{ price: { id: PRICE_CP, product_id: "p" } }] } }), none, prices);
    expect(cp).toMatchObject({ kind: "apply", patch: { subscription_tier: "creator_pro" } });
  });
  it("grants nothing for an unknown price", () => {
    expect(decidePaddleEntitlement(sub({ data: { items: [{ price: { id: "pri_unknown000000000000000" } }] } }), none, prices)).toEqual({ kind: "ignore", reason: "unknown_price" });
  });
  it("trialing grants access; a scheduled cancel keeps the plan until its date and says so", () => {
    expect(decidePaddleEntitlement(sub({ data: { status: "trialing" } }), none, prices)).toMatchObject({ kind: "apply", patch: { subscription_status: "trialing" } });
    const cancelling = decidePaddleEntitlement(sub({ event_type: "subscription.updated", data: { scheduled_change: { action: "cancel", effective_at: iso(86_400) } } }), none, prices);
    expect(cancelling).toMatchObject({ kind: "apply", patch: { subscription_tier: "pro", subscription_status: "active", subscription_end_date: iso(86_400) } });
  });
  it("past_due and paused keep the record but are not an access status", () => {
    const d = decidePaddleEntitlement(sub({ event_type: "subscription.past_due", data: { status: "past_due" } }), none, prices);
    expect(d).toMatchObject({ kind: "apply", patch: { subscription_status: "past_due" } });
  });
  it("downgrades to Free on cancel, only for the subscription it follows", () => {
    const follows: CurrentBilling = { ...none, tier: "pro", status: "active", provider: "paddle", paddleSubscriptionId: SUB, eventAt: iso(-100) };
    const cancel = sub({ event_type: "subscription.canceled", occurred_at: iso(10), data: { status: "canceled", canceled_at: iso(10) } });
    expect(decidePaddleEntitlement(cancel, follows, prices)).toMatchObject({ kind: "apply", patch: { subscription_tier: "free", subscription_status: "canceled", subscription_product_id: null } });
    expect(decidePaddleEntitlement({ ...cancel, data: { ...cancel.data, id: "sub_other" } }, follows, prices)).toEqual({ kind: "ignore", reason: "other_subscription" });
    // a complimentary plan (no Paddle subscription) is not Paddle's to remove
    expect(decidePaddleEntitlement(cancel, { ...none, tier: "pro", status: "active" }, prices)).toEqual({ kind: "ignore", reason: "other_subscription" });
  });
  it("ignores an older event that arrives after a newer one (out of order)", () => {
    const current: CurrentBilling = { ...none, tier: "free", status: "canceled", provider: "paddle", paddleSubscriptionId: SUB, eventAt: iso(100) };
    expect(decidePaddleEntitlement(sub({ occurred_at: iso(50) }), current, prices)).toEqual({ kind: "ignore", reason: "stale_event" });
    expect(decidePaddleEntitlement(sub({ occurred_at: iso(150) }), current, prices)).toMatchObject({ kind: "apply" });
  });
  it("a failed payment marks only the known subscription past_due and never grants", () => {
    const failed: PaddleEvent = { event_id: "evt_f", event_type: "transaction.payment_failed", occurred_at: iso(20), data: { subscription_id: SUB } };
    const active: CurrentBilling = { ...none, tier: "pro", status: "active", provider: "paddle", paddleSubscriptionId: SUB, eventAt: iso(0) };
    expect(decidePaddleEntitlement(failed, active, prices)).toMatchObject({ kind: "apply", patch: { subscription_tier: "pro", subscription_status: "past_due" } });
    expect(decidePaddleEntitlement(failed, none, prices)).toEqual({ kind: "ignore", reason: "no_matching_subscription" });
  });
  it("transaction.completed is a receipt, never an entitlement", () => {
    expect(decidePaddleEntitlement({ event_id: "evt_t", event_type: "transaction.completed", occurred_at: iso(0), data: { id: "txn_1", subscription_id: SUB } }, none, prices)).toEqual({ kind: "record_only", reason: "receipt" });
  });
  it("never touches the lifetime Founder tier and ignores events it does not handle", () => {
    expect(decidePaddleEntitlement(sub(), { ...none, tier: "founder", status: "active" }, prices)).toEqual({ kind: "ignore", reason: "lifetime_tier_protected" });
    expect(decidePaddleEntitlement({ event_id: "e", event_type: "customer.created", occurred_at: iso(0), data: {} }, none, prices)).toEqual({ kind: "ignore", reason: "unhandled_event_type" });
    expect(decidePaddleEntitlement({ event_id: "e", event_type: "subscription.created", occurred_at: "not a date", data: {} }, none, prices)).toEqual({ kind: "ignore", reason: "invalid_event" });
  });
  it("flags an overlap with a Stripe subscription that may still be billing", () => {
    const stripeUser: CurrentBilling = { ...none, tier: "pro", status: "active", provider: "stripe", hasStripeCustomer: true };
    const d = decidePaddleEntitlement(sub(), stripeUser, prices);
    expect(d).toMatchObject({ kind: "apply", notes: ["stripe_subscription_may_still_be_billing"] });
  });
});

// A tiny in-memory service-role client: enough of the query builder for the webhook.
function fakeDb(profile: Record<string, any> | null, opts: { failUpdate?: boolean } = {}) {
  const ledger = new Map<string, unknown>();
  const state = { profile: profile ? { ...profile } : null, updates: 0 };
  const db = {
    from(table: string) {
      if (table === "paddle_webhook_events") {
        return {
          insert: async (row: { event_id: string }) => {
            if (ledger.has(row.event_id)) return { error: { code: "23505" } };
            ledger.set(row.event_id, row);
            return { error: null };
          },
          delete: () => ({ eq: async (_c: string, id: string) => { ledger.delete(id); return { error: null }; } }),
        };
      }
      const filters: Record<string, string> = {};
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: string) => { filters[col] = val; return builder; },
        or: () => builder,
        maybeSingle: async () => {
          const p = state.profile;
          const hit = p && Object.entries(filters).every(([k, v]) => p[k] === v);
          return { data: hit ? { ...p } : null, error: null };
        },
        update: (patch: Record<string, any>) => {
          const upd: any = {
            eq: () => upd,
            or: () => upd,
            select: async () => {
              if (opts.failUpdate) return { data: null, error: { message: "boom" } };
              const p = state.profile;
              const newer = p?.subscription_event_at && Date.parse(p.subscription_event_at) > Date.parse(patch.subscription_event_at);
              if (!p || newer) return { data: [], error: null };
              Object.assign(p, patch);
              state.updates += 1;
              return { data: [{ user_id: p.user_id }], error: null };
            },
          };
          return upd;
        },
      };
      return builder;
    },
  };
  return { db, state, ledger };
}

async function deliver(event: PaddleEvent, deps: { db: any; secret?: string; env?: Record<string, string>; header?: string | null }) {
  const raw = JSON.stringify(event);
  const header = deps.header === undefined ? await buildPaddleSignatureHeader(raw, deps.secret ?? SECRET, NOW) : deps.header;
  const req = new Request("https://fn.example/paddle-webhook", { method: "POST", headers: header ? { "paddle-signature": header } : {}, body: raw });
  return handlePaddleWebhook(req, { db: deps.db, env: deps.env ?? ENV, nowSeconds: NOW, log: () => {} });
}

describe("paddle-webhook handler", () => {
  const baseProfile = { user_id: USER, subscription_tier: "free", subscription_status: "none", subscription_provider: null, paddle_subscription_id: null, subscription_event_at: null, stripe_customer_id: null };
  const bound = async (event: PaddleEvent): Promise<PaddleEvent> => ({ ...event, data: { ...event.data, custom_data: { user_id: USER, bind: await signCheckoutBinding(USER, SECRET) } } });

  it("rejects a bad signature before touching the ledger or the profile", async () => {
    const { db, state, ledger } = fakeDb(baseProfile);
    const res = await deliver(await bound(sub()), { db, secret: "wrong" });
    expect(res.status).toBe(400);
    expect(ledger.size).toBe(0);
    expect(state.updates).toBe(0);
    expect((await deliver(await bound(sub()), { db, header: null })).status).toBe(400);
  });
  it("fails closed when Paddle is misconfigured", async () => {
    const { db } = fakeDb(baseProfile);
    expect((await deliver(sub(), { db, env: { ...ENV, PADDLE_WEBHOOK_SECRET: "" } })).status).toBe(500);
    expect((await deliver(sub(), { db, env: { ...ENV, PADDLE_ENV: "" } })).status).toBe(500);
  });
  it("applies a verified, server-bound subscription.created and stores the provider ids", async () => {
    const { db, state } = fakeDb(baseProfile);
    expect((await deliver(await bound(sub()), { db })).status).toBe(200);
    expect(state.profile).toMatchObject({ subscription_tier: "pro", subscription_status: "active", subscription_provider: "paddle", paddle_subscription_id: SUB, paddle_customer_id: "ctm_01fixture" });
  });
  it("does not attribute an event whose user id has no server tag", async () => {
    const { db, state } = fakeDb(baseProfile);
    const forged = sub({ data: { custom_data: { user_id: USER, bind: "0".repeat(64) } } });
    expect((await deliver(forged, { db })).status).toBe(200);
    expect(state.profile?.subscription_tier).toBe("free");
    expect((await deliver(sub({ data: { custom_data: { user_id: USER } } }), { db })).status).toBe(200);
    expect(state.profile?.subscription_tier).toBe("free");
  });
  it("applies a duplicate delivery once (idempotent by event id)", async () => {
    const { db, state } = fakeDb(baseProfile);
    const event = await bound(sub());
    await deliver(event, { db });
    await deliver(event, { db });
    expect(state.updates).toBe(1);
  });
  it("keeps the newer state when events arrive out of order", async () => {
    const { db, state } = fakeDb(baseProfile);
    const created = await bound(sub({ event_id: "evt_a", occurred_at: iso(0) }));
    const canceled = sub({ event_id: "evt_b", event_type: "subscription.canceled", occurred_at: iso(60), data: { status: "canceled", canceled_at: iso(60) } });
    await deliver(created, { db });
    await deliver(canceled, { db });
    expect(state.profile).toMatchObject({ subscription_tier: "free", subscription_status: "canceled" });
    // the created event is redelivered later under a new id (late retry): it must not resurrect the plan
    await deliver({ ...created, event_id: "evt_a2" }, { db });
    expect(state.profile).toMatchObject({ subscription_tier: "free", subscription_status: "canceled" });
  });
  it("marks a failed renewal past_due without granting or removing the tier", async () => {
    const { db, state } = fakeDb(baseProfile);
    await deliver(await bound(sub()), { db });
    await deliver({ event_id: "evt_pf", event_type: "transaction.payment_failed", occurred_at: iso(30), data: { subscription_id: SUB } }, { db });
    expect(state.profile).toMatchObject({ subscription_tier: "pro", subscription_status: "past_due" });
  });
  it("answers 500 and gives the ledger row back when the write fails, so Paddle retries", async () => {
    const { db, ledger } = fakeDb(baseProfile, { failUpdate: true });
    const res = await deliver(await bound(sub()), { db });
    expect(res.status).toBe(500);
    expect(ledger.size).toBe(0);
  });
  it("leaves a complimentary plan alone when an unrelated subscription is canceled", async () => {
    const comp = { ...baseProfile, subscription_tier: "pro", subscription_status: "active" };
    const { db, state } = fakeDb(comp);
    const cancel = await bound(sub({ event_type: "subscription.canceled", data: { status: "canceled" } }));
    await deliver(cancel, { db });
    expect(state.profile).toMatchObject({ subscription_tier: "pro", subscription_status: "active" });
  });
});

describe("Paddle API client (mocked fetch)", () => {
  const ok = (data: unknown) => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data }) }));
  it("creates a server-priced transaction with the sandbox host and bearer key", async () => {
    const f = ok({ id: "txn_01fixture" });
    expect(await createTransaction(f, "sandbox", "pdl_sdbx_apikey_fixture", { priceId: PRICE_PRO, customData: { user_id: USER } })).toEqual({ id: "txn_01fixture" });
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://sandbox-api.paddle.com/transactions");
    expect(init.headers.Authorization).toBe("Bearer pdl_sdbx_apikey_fixture");
    expect(JSON.parse(init.body)).toMatchObject({ items: [{ price_id: PRICE_PRO, quantity: 1 }], custom_data: { user_id: USER } });
  });
  it("returns a portal link and never puts the API key in an error", async () => {
    expect(await createPortalSession(ok({ urls: { general: { overview: "https://customer-portal.paddle.com/x" } } }), "live", "k", { customerId: "ctm_1" })).toEqual({ url: "https://customer-portal.paddle.com/x" });
    const failing = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { code: "forbidden" } }) }));
    await expect(createTransaction(failing, "sandbox", "pdl_sdbx_apikey_TOPSECRET", { priceId: PRICE_PRO, customData: {} })).rejects.toThrow(/403, forbidden/);
    await expect(createTransaction(failing, "sandbox", "pdl_sdbx_apikey_TOPSECRET", { priceId: PRICE_PRO, customData: {} })).rejects.not.toThrow(/TOPSECRET/);
  });
});

describe("Paddle checkout start (server decides price and attribution)", () => {
  const free = { tier: "free", status: "none", provider: null, hasStripeCustomer: false };
  const okFetch = () => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { id: "txn_01fixture" } }) }));
  const start = (over: Partial<Parameters<typeof createPaddleCheckout>[0]> = {}) =>
    createPaddleCheckout({ env: ENV, fetchFn: okFetch(), userId: USER, tier: "pro", interval: "monthly", existing: free, ...over });

  it("prices from the server map, tags the user with the server binding and returns only public values", async () => {
    const f = okFetch();
    const res = await start({ fetchFn: f });
    expect(res).toEqual({ provider: "paddle", transactionId: "txn_01fixture", clientToken: ENV.PADDLE_CLIENT_TOKEN, environment: "sandbox" });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.items[0].price_id).toBe(PRICE_PRO);
    expect(await verifyCheckoutBinding(body.custom_data.user_id, body.custom_data.bind, SECRET)).toBe(true);
    expect(JSON.stringify(res)).not.toContain(ENV.PADDLE_API_KEY);
    expect(JSON.stringify(res)).not.toContain(SECRET);
  });
  it("ignores any client-supplied price: an unknown tier is refused", async () => {
    await expect(start({ tier: "pri_attacker" })).rejects.toBeInstanceOf(CheckoutRefusal);
    await expect(start({ tier: "founder" })).rejects.toMatchObject({ status: 400 });
  });
  it("refuses a second subscription (Paddle or Stripe) and Founder, but lets a Free or cancelled member subscribe", async () => {
    await expect(start({ existing: { tier: "pro", status: "active", provider: "paddle", hasStripeCustomer: false } })).rejects.toMatchObject({ status: 409 });
    await expect(start({ existing: { tier: "pro", status: "trialing", provider: "stripe", hasStripeCustomer: true } })).rejects.toMatchObject({ status: 409 });
    await expect(start({ existing: { tier: "founder", status: "active", provider: null, hasStripeCustomer: false } })).rejects.toMatchObject({ status: 409 });
    await expect(start({ existing: { tier: "free", status: "canceled", provider: "paddle", hasStripeCustomer: false } })).resolves.toMatchObject({ provider: "paddle" });
  });
  it("refuses to start when the environment is inconsistent", async () => {
    await expect(start({ env: { ...ENV, PADDLE_API_KEY: "pdl_live_apikey_x" } })).rejects.toThrow(/misconfigured/);
  });
});
