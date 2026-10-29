// What a return from a payment provider's browser redirect is allowed to claim. Landing on a success URL only means the
// browser came back: it is not a confirmed payment or an active plan. A claim of either needs the provider's
// confirmation (the webhook-updated record, or a verification call that succeeded and a paid tier on the profile).

const PAID_TIERS = new Set(["pro", "creator_pro", "founder", "brand_pro", "brand_enterprise"]);

export const isPaidTier = (tier?: string | null): boolean => !!tier && PAID_TIERS.has(tier);

export type SubscriptionReturn = "confirmed" | "unconfirmed";

/** "confirmed" only when verification did not fail and the profile now carries a paid tier. Anything else is unconfirmed. */
export function subscriptionReturnState(input: { verificationFailed: boolean; tier?: string | null }): SubscriptionReturn {
  return !input.verificationFailed && isPaidTier(input.tier) ? "confirmed" : "unconfirmed";
}

export interface ReturnNotice {
  kind: "pending" | "cancelled";
  title: string;
  description: string;
}

/** The notice for ?payment= on a project page after Stripe Checkout. The milestone itself updates when the webhook lands. */
export function milestoneReturnNotice(status: string | null): ReturnNotice | null {
  if (status === "success") {
    return {
      kind: "pending",
      title: "Back from checkout",
      description: "Stripe has not confirmed the payment yet. The milestone updates here once it does.",
    };
  }
  if (status === "cancelled") return { kind: "cancelled", title: "Payment cancelled", description: "No charge was made." };
  return null;
}
