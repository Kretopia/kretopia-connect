// Pure checks for the legacy, untiered event ticket purchase (`purchase-event-ticket`).
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: the function's only guard against buying twice was "no `jam_participants`
// row", and that row is written by `verify-event-ticket` only after payment. A
// buyer who pressed the button twice (or opened two tabs) therefore got two live
// Checkout sessions, could pay both, and the product has no refund flow for event
// tickets. The function also took payment for an event that had been cancelled.
//
// Rule: a buyer has at most one live purchase of an untiered ticket per event.
//   - an order already paid refuses the request;
//   - a purchase being created right now (an order with no session yet, a few
//     seconds old) refuses the request;
//   - an earlier open Checkout session for the same amount is handed back instead
//     of creating a second one; for another amount it is expired first;
//   - a session whose state cannot be read or understood refuses (fail closed).

export const STARTING_PURCHASE_SECONDS = 120;
export const MAX_SESSIONS_TO_CHECK = 3;

export interface PriorOrder {
  id: string;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
}

export interface PurchasePlan {
  /** the buyer already has a paid order for this event */
  paid: boolean;
  /** an order with no Checkout session yet, created within STARTING_PURCHASE_SECONDS */
  startingNow: boolean;
  /** earlier pending orders that have a Checkout session, newest first, at most MAX_SESSIONS_TO_CHECK */
  sessionsToCheck: Array<{ orderId: string; sessionId: string }>;
}

export function planFromPriorOrders(orders: PriorOrder[] | null | undefined, now: Date): PurchasePlan {
  const plan: PurchasePlan = { paid: false, startingNow: false, sessionsToCheck: [] };
  const sorted = [...(orders ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const o of sorted) {
    if (o.status === "paid") {
      plan.paid = true;
      continue;
    }
    if (o.status !== "pending") continue;
    if (o.stripe_session_id) {
      if (plan.sessionsToCheck.length < MAX_SESSIONS_TO_CHECK) {
        plan.sessionsToCheck.push({ orderId: o.id, sessionId: o.stripe_session_id });
      }
      continue;
    }
    const created = new Date(o.created_at).getTime();
    // An unreadable date counts as "starting now": it refuses rather than guesses.
    if (!Number.isFinite(created) || now.getTime() - created < STARTING_PURCHASE_SECONDS * 1000) {
      plan.startingNow = true;
    }
  }
  return plan;
}

export type TicketSessionAction = "paid" | "reuse" | "recreate" | "unknown";

export interface SessionView {
  status?: string | null;
  url?: string | null;
  amount_total?: number | null;
  currency?: string | null;
}

/**
 * What to do with an earlier Checkout session of the same buyer and event.
 *  - "paid": the customer completed it (payment confirmed or still settling): no second purchase.
 *  - "reuse": still open, same amount and currency, has a URL: hand it back.
 *  - "recreate": expired, or open at another price (the caller expires it first): start a new one.
 *  - "unknown": a state this code does not know: refuse.
 */
export function classifyTicketSession(
  session: SessionView | null | undefined,
  expected: { amountCents: number; currency: string },
): TicketSessionAction {
  if (!session) return "recreate";
  switch (session.status) {
    case "complete":
      return "paid";
    case "open": {
      const sameAmount = session.amount_total === expected.amountCents;
      const sameCurrency = String(session.currency ?? "").toLowerCase() === expected.currency.toLowerCase();
      return sameAmount && sameCurrency && typeof session.url === "string" && session.url.length > 0
        ? "reuse"
        : "recreate";
    }
    case "expired":
      return "recreate";
    default:
      return "unknown";
  }
}
