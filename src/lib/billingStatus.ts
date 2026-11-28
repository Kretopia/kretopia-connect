// What the subscription page may say about a plan, from the status the payment provider's signed webhooks stored. Plain words:
// a failed payment is "payment failed", never "active"; nothing here claims a payment the provider has not confirmed.

export type BillingNoticeTone = "warn" | "info";

export interface BillingNotice {
  tone: BillingNoticeTone;
  title: string;
  body: string;
}

/** Statuses for which the member still has a billing account worth opening (to fix a card, read invoices, cancel). */
export const MANAGEABLE_STATUSES: readonly string[] = ["active", "trialing", "past_due", "paused"];

export const canManageBilling = (status: string | null | undefined): boolean => !!status && MANAGEABLE_STATUSES.includes(status);

export function billingNotice(status: string | null | undefined): BillingNotice | null {
  switch (status) {
    case "past_due":
      return {
        tone: "warn",
        title: "Your last payment failed",
        body: "Paid features are paused until a payment goes through. Open Manage Subscription to update your payment method; your work and data stay as they are.",
      };
    case "paused":
      return { tone: "info", title: "Your subscription is paused", body: "Paid features are off while it is paused. Your work and data stay as they are." };
    case "canceled":
      return { tone: "info", title: "Your subscription has ended", body: "You are on the Free plan. Your work and data stay as they are, and you can subscribe again at any time." };
    default:
      return null;
  }
}
