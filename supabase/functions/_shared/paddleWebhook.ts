// The Paddle webhook, as a function of (request, dependencies) so it is tested without Deno, a network or a database. The edge
// function (paddle-webhook/index.ts) only wires the environment and the service-role client into it.
//
// Order is the point: verify the signature on the raw body → claim the event id in the ledger (a redelivery is answered 200 and not
// applied again) → attribute the event to a user (stored subscription id, else the server-signed checkout binding) → let the pure
// reducer decide → write only what the decision allows. Anything that fails after the claim gives the ledger row back and answers
// 500 so Paddle retries; an event that can never apply (stale, unknown price, unattributed) is answered 200 and logged by reason.

import { claimPaddleEvent, releasePaddleEvent } from "./paddleLedger.ts";
import { verifyCheckoutBinding, verifyPaddleSignature } from "./paddleSignature.ts";
import { checkPaddleEnv, paddlePrices, type EnvSource } from "./paddleEnv.ts";
import { decidePaddleEntitlement, type CurrentBilling, type PaddleEvent } from "./paddleEntitlements.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export interface PaddleWebhookDeps {
  db: Db;
  env: EnvSource;
  nowSeconds?: number;
  log?: (message: string, detail?: Record<string, unknown>) => void;
}

const PROFILE_COLUMNS = "user_id, subscription_tier, subscription_status, subscription_provider, paddle_subscription_id, subscription_event_at, stripe_customer_id";

const reply = (status: number, body: string) => new Response(body, { status });

export async function handlePaddleWebhook(req: Request, deps: PaddleWebhookDeps): Promise<Response> {
  const log = deps.log ?? ((m, d) => console.log(`[paddle-webhook] ${m}`, d ?? ""));
  if (req.method !== "POST") return reply(405, "method not allowed");

  const report = checkPaddleEnv(deps.env, { webhookSecret: true });
  if (!report.ok) {
    log("misconfigured", { errors: report.errors });
    return reply(500, "misconfigured");
  }
  const secret = deps.env.PADDLE_WEBHOOK_SECRET as string;

  const raw = await req.text();
  const verified = await verifyPaddleSignature(raw, req.headers.get("paddle-signature"), secret, 300, deps.nowSeconds);
  if (verified.ok === false) {
    log("signature rejected", { reason: verified.reason });
    return reply(400, "bad signature");
  }
  const event = verified.payload as PaddleEvent;
  if (!event || typeof event.event_id !== "string" || typeof event.event_type !== "string") return reply(400, "bad event");

  const claim = await claimPaddleEvent(deps.db, event);
  if (claim === "duplicate") return reply(200, "ok");
  if (claim === "unavailable") return reply(500, "ledger unavailable");

  try {
    const subscriptionId: string | null = typeof event.data?.subscription_id === "string" ? event.data.subscription_id
      : event.event_type.startsWith("subscription.") && typeof event.data?.id === "string" ? event.data.id : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let row: Record<string, any> | null = null;
    if (subscriptionId) {
      const found = await deps.db.from("profiles").select(PROFILE_COLUMNS).eq("paddle_subscription_id", subscriptionId).maybeSingle();
      if (found.error) throw new Error(`profile lookup failed: ${found.error.message}`);
      row = found.data ?? null;
    }
    if (!row) {
      const userId = event.data?.custom_data?.user_id;
      const bound = await verifyCheckoutBinding(userId, event.data?.custom_data?.bind, secret);
      if (bound) {
        const found = await deps.db.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
        if (found.error) throw new Error(`profile lookup failed: ${found.error.message}`);
        row = found.data ?? null;
      }
    }
    if (!row) {
      log("ignored", { event_id: event.event_id, type: event.event_type, reason: "unattributed" });
      return reply(200, "ok");
    }

    const current: CurrentBilling = {
      tier: row.subscription_tier ?? null,
      status: row.subscription_status ?? null,
      provider: row.subscription_provider ?? null,
      paddleSubscriptionId: row.paddle_subscription_id ?? null,
      eventAt: row.subscription_event_at ?? null,
      hasStripeCustomer: Boolean(row.stripe_customer_id),
    };
    const decision = decidePaddleEntitlement(event, current, paddlePrices(deps.env));

    if (decision.kind === "ignore") {
      log("ignored", { event_id: event.event_id, type: event.event_type, reason: decision.reason });
      return reply(200, "ok");
    }
    if (decision.kind === "record_only") {
      log("recorded", { event_id: event.event_id, type: event.event_type, reason: decision.reason });
      return reply(200, "ok");
    }

    // The guard in the write itself: if a newer event landed between the read and this write, nothing is overwritten.
    const written = await deps.db.from("profiles").update(decision.patch)
      .eq("user_id", row.user_id)
      .or(`subscription_event_at.is.null,subscription_event_at.lte.${decision.patch.subscription_event_at}`)
      .select("user_id");
    if (written.error) throw new Error(`profile update failed: ${written.error.message}`);
    if (!written.data?.length) {
      log("ignored", { event_id: event.event_id, type: event.event_type, reason: "stale_event" });
      return reply(200, "ok");
    }
    log("applied", { event_id: event.event_id, type: event.event_type, tier: decision.patch.subscription_tier, status: decision.patch.subscription_status, notes: decision.notes });
    return reply(200, "ok");
  } catch (err) {
    log("handler error", { message: err instanceof Error ? err.message : String(err) });
    if (claim === "claimed") await releasePaddleEvent(deps.db, event.event_id);
    return reply(500, "handler error");
  }
}
