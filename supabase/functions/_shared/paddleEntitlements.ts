// What a VERIFIED Paddle event is allowed to change on a profile. Pure: no network, no database, no environment.
//
// The one rule this module exists to keep: a plan changes only because Paddle said so in a signature-verified event. Nothing the
// browser reports (a checkout "success" callback, a redirect, a client-supplied tier or price) reaches this function, and the
// price id on the event is the only way a purchase becomes a tier (via the PADDLE_PRICE_* map), so a client can never pick one.
//
// It decides; the webhook applies. A decision is one of:
//   apply        the profile patch to write (a subset of the profile's subscription columns)
//   record_only  a fact worth keeping (a receipt) that changes no entitlement
//   ignore       with the reason: stale, foreign, unknown or protected
//
// Ordering: Paddle does not guarantee delivery order. Every applied patch stores the event's `occurred_at`; an older event than the
// stored one is ignored. Duplicates are removed upstream by the event ledger (same event_id), not here.

import type { BillingInterval, PaddlePriceMap, PaidTier } from "./paddleEnv.ts";

export interface PaddleEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  notification_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payloads are untyped JSON
  data: Record<string, any>;
}

/** What the profile row currently says, as far as billing goes. */
export interface CurrentBilling {
  tier: string | null;
  status: string | null;
  provider: "stripe" | "paddle" | null;
  paddleSubscriptionId: string | null;
  /** occurred_at of the last Paddle event applied. */
  eventAt: string | null;
  /** True when the profile has a Stripe customer, i.e. a Stripe subscription may still be billing. */
  hasStripeCustomer: boolean;
}

export interface ProfilePatch {
  subscription_tier: string;
  subscription_status: string;
  subscription_product_id?: string | null;
  subscription_end_date?: string | null;
  subscription_provider: "paddle";
  paddle_customer_id?: string | null;
  paddle_subscription_id?: string | null;
  subscription_event_at: string;
}

export type IgnoreReason =
  | "stale_event"
  | "unknown_price"
  | "other_subscription"
  | "no_matching_subscription"
  | "lifetime_tier_protected"
  | "unhandled_event_type"
  | "unhandled_status"
  | "invalid_event";

export type Decision =
  | { kind: "apply"; patch: ProfilePatch; notes: string[] }
  | { kind: "record_only"; reason: "receipt" }
  | { kind: "ignore"; reason: IgnoreReason };

/** The lifetime tier is never touched by a subscription provider. */
export const PROTECTED_TIERS: readonly string[] = ["founder"];

/** Statuses that grant paid access. Everything else (past_due, paused, canceled) is shown honestly and does not. */
export const ACCESS_STATUSES: readonly string[] = ["active", "trialing"];

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.trialing",
  "subscription.updated",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
]);

const ts = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isNaN(n) ? null : n;
};

/** The user a subscription event is about: set by our own checkout, never by the buyer's browser state. */
export function eventUserId(event: PaddleEvent): string | null {
  const id = event.data?.custom_data?.user_id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export function decidePaddleEntitlement(event: PaddleEvent, current: CurrentBilling, prices: PaddlePriceMap): Decision {
  const at = ts(event?.occurred_at);
  if (!event?.event_id || !event.event_type || at === null || typeof event.data !== "object" || event.data === null) {
    return { kind: "ignore", reason: "invalid_event" };
  }
  if (current.tier && PROTECTED_TIERS.includes(current.tier)) return { kind: "ignore", reason: "lifetime_tier_protected" };

  const data = event.data;
  const storedAt = ts(current.eventAt);

  if (event.event_type === "transaction.completed") return { kind: "record_only", reason: "receipt" };

  if (event.event_type === "transaction.payment_failed") {
    // A failed renewal only matters for the subscription we already know; it never grants or removes a tier by itself.
    if (!data.subscription_id || data.subscription_id !== current.paddleSubscriptionId) return { kind: "ignore", reason: "no_matching_subscription" };
    if (storedAt !== null && at < storedAt) return { kind: "ignore", reason: "stale_event" };
    if (!current.status || !ACCESS_STATUSES.includes(current.status)) return { kind: "ignore", reason: "unhandled_status" };
    return {
      kind: "apply",
      notes: [],
      patch: {
        subscription_tier: current.tier ?? "free",
        subscription_status: "past_due",
        subscription_provider: "paddle",
        paddle_subscription_id: current.paddleSubscriptionId,
        subscription_event_at: event.occurred_at,
      },
    };
  }

  if (!SUBSCRIPTION_EVENTS.has(event.event_type)) return { kind: "ignore", reason: "unhandled_event_type" };

  const subscriptionId: string | null = typeof data.id === "string" ? data.id : null;
  if (!subscriptionId) return { kind: "ignore", reason: "invalid_event" };
  const sameSubscription = subscriptionId === current.paddleSubscriptionId;
  if (storedAt !== null && at < storedAt) return { kind: "ignore", reason: "stale_event" };

  const status: string = typeof data.status === "string" ? data.status : "";
  const customerId: string | null = typeof data.customer_id === "string" ? data.customer_id : null;

  if (status === "canceled") {
    // Only the subscription we follow can end the plan: a late cancel of an older subscription must not take a newer one away,
    // and a complimentary plan (no Paddle subscription) is not Paddle's to remove.
    if (!sameSubscription) return { kind: "ignore", reason: "other_subscription" };
    return {
      kind: "apply",
      notes: [],
      patch: {
        subscription_tier: "free",
        subscription_status: "canceled",
        subscription_product_id: null,
        subscription_end_date: data.canceled_at ?? event.occurred_at,
        subscription_provider: "paddle",
        paddle_customer_id: customerId,
        paddle_subscription_id: subscriptionId,
        subscription_event_at: event.occurred_at,
      },
    };
  }

  if (status !== "active" && status !== "trialing" && status !== "past_due" && status !== "paused") {
    return { kind: "ignore", reason: "unhandled_status" };
  }

  const item = Array.isArray(data.items) ? data.items[0] : null;
  const priceId: string | null = typeof item?.price?.id === "string" ? item.price.id : null;
  const priced = priceId ? prices.byPriceId.get(priceId) : undefined;
  if (!priced) return { kind: "ignore", reason: "unknown_price" };

  const scheduledCancel = data.scheduled_change?.action === "cancel" ? data.scheduled_change.effective_at : null;
  const periodEnd = data.current_billing_period?.ends_at ?? null;
  const notes: string[] = [];
  if (!sameSubscription && current.hasStripeCustomer && current.status && ACCESS_STATUSES.includes(current.status) && current.provider !== "paddle") {
    notes.push("stripe_subscription_may_still_be_billing");
  }

  return {
    kind: "apply",
    notes,
    patch: {
      subscription_tier: priced.tier,
      subscription_status: status,
      subscription_product_id: typeof item?.price?.product_id === "string" ? item.price.product_id : null,
      subscription_end_date: scheduledCancel ?? periodEnd,
      subscription_provider: "paddle",
      paddle_customer_id: customerId,
      paddle_subscription_id: subscriptionId,
      subscription_event_at: event.occurred_at,
    },
  };
}

/** Whether a stored status currently grants paid access (the one definition the client mirrors). */
export const grantsAccess = (status: string | null | undefined): boolean => !!status && ACCESS_STATUSES.includes(status);

export type { BillingInterval, PaidTier };
