// Pure, dependency-free decisions for "may this buyer be handed the files of a
// product". Imported by edge functions (Deno) and by tests (Vite).
//
// Why these exist: purchased files are issued as signed URLs by functions that
// use the service role, so the function is the only gate. Two records they used
// as proof of payment are not proof:
//   - digital_product_purchases has an INSERT policy for the buyer
//     ("Users can create purchases", auth.uid() = buyer_id), so a row there can
//     be written by the person it would entitle, with any payment_status;
//   - marketplace_orders.status is not consulted at all today (pending,
//     refunded and disputed orders download like completed ones).
// A legacy purchase row therefore counts only when the provider confirms the
// payment, and a checkout session counts only for the product and buyer its own
// (server-written) metadata names.
//
// Rule: deny on anything that cannot be proven. A failed provider lookup is not
// "no": it answers 503 and grants nothing.

/** Order states that entitle the buyer to the product's files. */
export const ENTITLED_ORDER_STATUSES = ["completed", "escrow"] as const;

export function orderGrantsFiles(status: unknown): boolean {
  return typeof status === "string" && (ENTITLED_ORDER_STATUSES as readonly string[]).includes(status);
}

export type EntitlementDecision =
  | { ok: true }
  | { ok: false; status: 403 | 503; error: string };

export interface LegacyPurchaseFacts {
  /** digital_product_purchases.payment_status (client-writable: necessary, not sufficient). */
  paymentStatus: unknown;
  paymentIntentId: unknown;
  /** From the payment provider, not from our tables. */
  intentStatus: unknown;
  intentMetadata: Record<string, unknown> | null | undefined;
  /** The charge was refunded in full. */
  refunded: boolean;
  productId: string;
  userId: string;
  /** The provider lookup failed or was not possible. */
  lookupFailed?: boolean;
}

export function decideLegacyPurchase(f: LegacyPurchaseFacts): EntitlementDecision {
  if (f.paymentStatus !== "completed") return { ok: false, status: 403, error: "No purchase found" };
  if (typeof f.paymentIntentId !== "string" || !f.paymentIntentId) {
    return { ok: false, status: 403, error: "No purchase found" };
  }
  if (f.lookupFailed) return { ok: false, status: 503, error: "Could not verify this purchase" };
  if (f.intentStatus !== "succeeded" || f.refunded) return { ok: false, status: 403, error: "No purchase found" };
  const meta = f.intentMetadata ?? {};
  if (meta.product_id !== f.productId || meta.buyer_id !== f.userId) {
    return { ok: false, status: 403, error: "No purchase found" };
  }
  return { ok: true };
}

export interface CheckoutSessionFacts {
  /** session.metadata.* as written by purchase-digital-product. */
  sessionType: unknown;
  sessionProductId: unknown;
  sessionBuyerId: unknown;
  /** What the caller asked to complete. */
  requestedProductId: unknown;
  userId: string;
}

/**
 * A paid checkout session may complete only the marketplace purchase it was
 * created for, and only for the buyer it names. A missing field is a refusal,
 * not a pass: the previous check skipped the buyer test when the metadata had
 * no buyer_id and never compared the product at all.
 */
export function decideCheckoutSessionBinding(f: CheckoutSessionFacts): EntitlementDecision {
  if (f.sessionType !== "marketplace_purchase") {
    return { ok: false, status: 403, error: "This payment is not a product purchase" };
  }
  if (typeof f.sessionBuyerId !== "string" || f.sessionBuyerId !== f.userId) {
    return { ok: false, status: 403, error: "Unauthorized: session does not belong to you" };
  }
  if (
    typeof f.requestedProductId !== "string" ||
    typeof f.sessionProductId !== "string" ||
    f.sessionProductId !== f.requestedProductId
  ) {
    return { ok: false, status: 403, error: "This payment does not belong to that product" };
  }
  return { ok: true };
}
