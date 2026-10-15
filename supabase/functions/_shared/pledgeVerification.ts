// Pure decisions for ThriveFund finalization. Imported by edge functions (Deno)
// and by tests (Vite). No dependency.
//
// Why: a pledge row is written as `authorized` when the Checkout session is
// created, before the backer has paid, and the database totals count that
// status. The finalizer used to decide "goal met" from `campaigns.total_raised`,
// so rows that were never authorised at Stripe could push a campaign over its
// goal and make the finalizer capture the genuine backers' cards
// (docs/roadmap/proposal-thrivefund-pledge-authorization-state.md, option B).
//
// Rule: a pledge counts toward the goal only when Stripe itself says its
// payment intent is authorised and capturable for at least the pledged amount,
// in the campaign's currency, and the intent names this pledge and this
// campaign. Anything else counts for nothing and is cancelled. A pledge that
// was already captured or released was verified when it was captured, so it
// counts as settled. Money is compared in integer cents; a goal that is not a
// positive number is never met.

export interface PledgeLike {
  id: string;
  amount: unknown;
}

export interface PaymentIntentLike {
  id?: string;
  status?: string | null;
  amount_capturable?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}

export type PledgeRefusal =
  | "no_payment_intent"
  | "bad_amount"
  | "intent_not_capturable"
  | "amount_not_covered"
  | "wrong_pledge"
  | "wrong_campaign"
  | "wrong_currency";

export type PledgeVerdict = { verified: true; cents: number } | { verified: false; reason: PledgeRefusal };

/** A positive amount in integer cents, or null. */
export function toCents(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function verifyPledgeAuthorization(
  pledge: PledgeLike,
  intent: PaymentIntentLike | null | undefined,
  ctx: { campaignId: string; campaignCurrency?: string | null },
): PledgeVerdict {
  if (!intent) return { verified: false, reason: "no_payment_intent" };
  const cents = toCents(pledge.amount);
  if (cents === null) return { verified: false, reason: "bad_amount" };
  if (intent.status !== "requires_capture") return { verified: false, reason: "intent_not_capturable" };
  const capturable = typeof intent.amount_capturable === "number" ? intent.amount_capturable : 0;
  if (capturable < cents) return { verified: false, reason: "amount_not_covered" };
  if (intent.metadata?.pledge_id !== pledge.id) return { verified: false, reason: "wrong_pledge" };
  if (intent.metadata?.campaign_id !== ctx.campaignId) return { verified: false, reason: "wrong_campaign" };
  const want = (ctx.campaignCurrency || "USD").toLowerCase();
  if ((intent.currency ?? "").toLowerCase() !== want) return { verified: false, reason: "wrong_currency" };
  return { verified: true, cents };
}

export interface FinalizationSummary {
  raisedCents: number;
  goalCents: number | null;
  goalMet: boolean;
}

/**
 * `settledCents`: pledges already captured or released (verified when captured).
 * `verifiedCents`: the authorised pledges that passed `verifyPledgeAuthorization`.
 */
export function summarizeFinalization(input: {
  settledCents: number;
  verifiedCents: number[];
  goalAmount: unknown;
}): FinalizationSummary {
  const raisedCents = input.verifiedCents.reduce((s, c) => s + c, input.settledCents);
  const goalCents = toCents(input.goalAmount);
  return { raisedCents, goalCents, goalMet: goalCents !== null && raisedCents >= goalCents };
}
