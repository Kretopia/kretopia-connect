// One atomic transition for an event ticket order: pending -> paid, exactly once.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: `verify-event-ticket` read `order.status`, asked Stripe, reserved the tier's
// capacity, incremented the promo code's use count, and only then wrote `paid`.
// The order's success page (EventPage) and the sessions list (SessionsSection)
// both call it, so two verifications of the same order in the same moment both
// passed the "not paid yet" read and both counted: the tier's `quantity_sold`
// and the code's `uses_count` went up twice for one purchase.
//
// Rule: the verification that turns the order into `paid` (an UPDATE guarded by
// `status <> 'paid'`) is the only one that applies the counters; any other
// concurrent verification gets "already_paid" and applies nothing.

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type OrderClaim = "claimed" | "already_paid" | "error";

/**
 * Marks the order paid if, and only if, it is not paid yet. "claimed" means this call made the
 * transition and must apply the counters; "already_paid" means another verification did (or is
 * doing) it; "error" means the order could not be written or read, so nothing may be granted.
 */
export async function claimOrderPaid(
  db: Db,
  orderId: string,
  patch: Record<string, unknown> = {},
): Promise<OrderClaim> {
  const { data, error } = await db
    .from("event_orders")
    .update({ ...patch, status: "paid" })
    .eq("id", orderId)
    .neq("status", "paid")
    .select("id");
  if (error) return "error";
  if (Array.isArray(data) && data.length > 0) return "claimed";

  // No row changed: either someone else paid it, or the order is gone. Do not call that "paid".
  const { data: row, error: readErr } = await db
    .from("event_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (readErr || !row) return "error";
  return row.status === "paid" ? "already_paid" : "error";
}
