// Starting a Paddle checkout, decided on the server. The browser sends a tier and an interval and nothing else: the price id comes
// from PADDLE_PRICE_*, the user from the verified session, and the attribution (user id + server tag) rides in the transaction's
// custom_data, so what Paddle later reports can be tied to the right member and to nobody a browser names.

import { assertPaddleEnv, billingProvider, isPaidTier, paddlePrices, type BillingInterval, type EnvSource } from "./paddleEnv.ts";
import { createTransaction, type FetchLike } from "./paddleApi.ts";
import { signCheckoutBinding } from "./paddleSignature.ts";
import { ACCESS_STATUSES } from "./paddleEntitlements.ts";

export class CheckoutRefusal extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface ExistingBilling {
  tier: string | null;
  status: string | null;
  provider: string | null;
  hasStripeCustomer: boolean;
}

export interface PaddleCheckoutResult {
  provider: "paddle";
  transactionId: string;
  clientToken: string;
  environment: "sandbox" | "live";
}

export { billingProvider };

export async function createPaddleCheckout(input: {
  env: EnvSource;
  fetchFn: FetchLike;
  userId: string;
  tier: unknown;
  interval: unknown;
  existing: ExistingBilling;
}): Promise<PaddleCheckoutResult> {
  const environment = assertPaddleEnv(input.env, { apiKey: true, webhookSecret: true, clientToken: true, prices: true });
  if (typeof input.tier !== "string" || !isPaidTier(input.tier)) throw new CheckoutRefusal(400, "Unknown or missing subscription tier");
  const interval: BillingInterval = input.interval === "yearly" ? "yearly" : "monthly";

  const e = input.existing;
  const paying = !!e.status && ACCESS_STATUSES.includes(e.status) && !!e.tier && e.tier !== "free";
  if (e.tier === "founder") throw new CheckoutRefusal(409, "Founder Circle already includes lifetime access.");
  if (paying && e.provider === "paddle") throw new CheckoutRefusal(409, "You already have a subscription. Use Manage billing to change or cancel it.");
  // A Stripe subscription may still be billing: starting a second one here would charge twice.
  if (paying && e.hasStripeCustomer && e.provider !== "paddle") throw new CheckoutRefusal(409, "You already have a subscription. Use Manage billing to change or cancel it.");

  const priceId = paddlePrices(input.env).priceFor(input.tier, interval);
  if (!priceId) throw new CheckoutRefusal(500, "This plan is not available for checkout yet.");

  const bind = await signCheckoutBinding(input.userId, input.env.PADDLE_WEBHOOK_SECRET as string);
  const txn = await createTransaction(input.fetchFn, environment, input.env.PADDLE_API_KEY as string, {
    priceId,
    customData: { user_id: input.userId, bind },
  });
  return { provider: "paddle", transactionId: txn.id, clientToken: input.env.PADDLE_CLIENT_TOKEN as string, environment };
}
