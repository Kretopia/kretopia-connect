// Event ticket finalization: called ONLY from the signature-verified stripe-marketplace-webhook
// (checkout.session.completed). Browser return pages never activate tickets.
import { claimOrderPaid } from "./orderConfirmation.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;
const log = (s: string, d?: unknown) =>
  console.log(`[event-ticket-activation] ${s}${d ? " " + JSON.stringify(d) : ""}`);

// deno-lint-ignore no-explicit-any
export async function finalizeEventOrder(admin: Admin, session: any): Promise<"paid" | "already_paid" | "skipped"> {
  const orderId = session?.metadata?.order_id;
  if (!orderId || session.payment_status !== "paid") return "skipped";
  const { data: order, error: orderErr } = await admin
    .from("event_orders").select("*").eq("id", orderId).maybeSingle();
  if (orderErr) throw new Error("Could not read the event order");
  if (!order || order.stripe_session_id !== session.id) {
    log("order/session mismatch, skipped", { orderId });
    return "skipped";
  }
  if (order.status === "paid") return "already_paid";

    const claim = await claimOrderPaid(admin, order.id, {
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    if (claim === "error") throw new Error("Could not record the event payment");
    if (claim === "already_paid") return "already_paid";
    log("order claimed paid", { orderId: order.id });

    // Atomic check-and-increment against the tier's capacity (tiered orders
    // only -- legacy untiered orders from purchase-event-ticket have
    // tier_id = null and were never tracked against a tier's capacity).
    // Replaces a bare read-then-write that (a) could silently lose an
    // increment under concurrent payment confirmations for the same tier
    // and (b) never re-checked capacity at all, so a tier could be sold
    // arbitrarily far past quantity_total once enough concurrent buyers got
    // past checkout-event-tickets' pre-check. See
    // reserve_event_ticket_capacity() in
    // 20260915100000_close_event_ticket_capacity_race_and_status_drift.sql.
    let capacityExceeded = false;
    if (order.tier_id) {
      const { data: reservation, error: reserveErr } = await admin
        .rpc("reserve_event_ticket_capacity", { _tier_id: order.tier_id, _quantity: order.quantity })
        .single();
      if (reserveErr) {
        // Stripe already captured payment by this point -- don't fail
        // verification over a counter update. Log loudly; the order is
        // already marked paid and the buyer still gets seated below.
        log("capacity RPC error (non-fatal, payment already captured)", { orderId: order.id, msg: reserveErr.message });
      } else if (!reservation?.allowed) {
        // Payment already succeeded on Stripe by the time we got here --
        // this codebase has no refund flow for event tickets
        // (event_orders.refunded_at/refund_amount are unused, see their
        // COMMENT ON COLUMN) and this function must not call Stripe to move
        // money, so an already-paid buyer is not denied their seat here.
        // What the atomic check buys us: this is now a *detected, flagged*
        // overbook instead of a silent, uncounted one -- visible on the
        // order (metadata.capacity_exceeded) for manual host/admin
        // follow-up, instead of the counter just quietly drifting.
        capacityExceeded = true;
        log("CAPACITY EXCEEDED at payment confirmation -- seating anyway (already paid)", {
          orderId: order.id, tierId: order.tier_id, quantity: order.quantity,
        });
      }
    }

    // Flag a detected overbook on the order (it is already paid, see above).
    if (capacityExceeded) {
      await admin.from("event_orders")
        .update({ metadata: { ...(order.metadata || {}), capacity_exceeded: true } })
        .eq("id", order.id);
    }

    if (order.promo_code_id) {
      await admin.rpc("increment_promo_use", { _id: order.promo_code_id }).catch(() => {});
    }

    // 'going' matches jam_participants_status_check and every other RSVP
    // code path -- this used to write 'rsvp', a value the constraint has
    // never allowed, so the upsert was silently failing (error not checked)
    // on every paid ticket purchase and the buyer never actually joined the
    // guest list despite having paid.
    await admin.from("jam_participants").upsert({
      jam_id: order.event_id,
      user_id: order.buyer_id,
      status: "going",
    }, { onConflict: "jam_id,user_id" });

  return "paid";
}
