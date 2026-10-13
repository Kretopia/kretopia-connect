import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decideCheckoutSessionBinding,
  decideLegacyPurchase,
  orderGrantsFiles,
} from "../../../supabase/functions/_shared/purchaseEntitlement";

const BUYER = "buyer-1";
const PRODUCT = "product-1";

describe("orderGrantsFiles: which order states entitle the buyer", () => {
  it("entitles a completed order and an escrow order", () => {
    expect(orderGrantsFiles("completed")).toBe(true);
    expect(orderGrantsFiles("escrow")).toBe(true);
  });

  it("does not entitle pending, refunded or disputed orders", () => {
    for (const s of ["pending", "refunded", "disputed"]) expect(orderGrantsFiles(s)).toBe(false);
  });

  it("does not entitle an unknown, empty or missing status", () => {
    for (const s of ["", "paid", "COMPLETED", null, undefined, 1]) expect(orderGrantsFiles(s)).toBe(false);
  });
});

describe("decideLegacyPurchase: a purchase row is not proof of payment", () => {
  const paid = {
    paymentStatus: "completed",
    paymentIntentId: "pi_1",
    intentStatus: "succeeded",
    intentMetadata: { product_id: PRODUCT, buyer_id: BUYER },
    refunded: false,
    productId: PRODUCT,
    userId: BUYER,
  };

  it("accepts a row the provider confirms for this product and this buyer", () => {
    expect(decideLegacyPurchase(paid)).toEqual({ ok: true });
  });

  it("refuses a row the buyer wrote with a status other than completed", () => {
    expect(decideLegacyPurchase({ ...paid, paymentStatus: "pending" })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a self-written 'completed' row that carries no payment intent", () => {
    expect(decideLegacyPurchase({ ...paid, paymentIntentId: null })).toMatchObject({ ok: false, status: 403 });
    expect(decideLegacyPurchase({ ...paid, paymentIntentId: "" })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses when the provider has never seen the payment intent (no status returned)", () => {
    expect(decideLegacyPurchase({ ...paid, intentStatus: null, intentMetadata: null })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses an intent that is not succeeded", () => {
    for (const s of ["requires_payment_method", "requires_capture", "canceled", "processing"]) {
      expect(decideLegacyPurchase({ ...paid, intentStatus: s })).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("refuses a payment that was refunded", () => {
    expect(decideLegacyPurchase({ ...paid, refunded: true })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a real payment made for another product or by another buyer", () => {
    expect(decideLegacyPurchase({ ...paid, intentMetadata: { product_id: "other", buyer_id: BUYER } })).toMatchObject({ ok: false, status: 403 });
    expect(decideLegacyPurchase({ ...paid, intentMetadata: { product_id: PRODUCT, buyer_id: "someone-else" } })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses an intent without metadata: the payment cannot be tied to this buyer", () => {
    expect(decideLegacyPurchase({ ...paid, intentMetadata: {} })).toMatchObject({ ok: false, status: 403 });
    expect(decideLegacyPurchase({ ...paid, intentMetadata: null })).toMatchObject({ ok: false, status: 403 });
  });

  it("answers 503 and grants nothing when the provider lookup failed", () => {
    expect(decideLegacyPurchase({ ...paid, intentStatus: null, intentMetadata: null, lookupFailed: true }))
      .toMatchObject({ ok: false, status: 503 });
  });
});

describe("decideCheckoutSessionBinding: a paid session completes only its own purchase", () => {
  const session = {
    sessionType: "marketplace_purchase",
    sessionProductId: PRODUCT,
    sessionBuyerId: BUYER,
    requestedProductId: PRODUCT,
    userId: BUYER,
  };

  it("accepts the session of this product and this buyer", () => {
    expect(decideCheckoutSessionBinding(session)).toEqual({ ok: true });
  });

  it("refuses a paid session used to complete a different product (pay cheap, get expensive)", () => {
    expect(decideCheckoutSessionBinding({ ...session, requestedProductId: "expensive-product" }))
      .toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a paid session of another kind (ticket, invoice, milestone)", () => {
    for (const t of ["milestone_payment", "event_ticket", undefined, null, ""]) {
      expect(decideCheckoutSessionBinding({ ...session, sessionType: t })).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("refuses another user's session", () => {
    expect(decideCheckoutSessionBinding({ ...session, sessionBuyerId: "someone-else" })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a session whose metadata has no buyer: a missing field is not a pass", () => {
    expect(decideCheckoutSessionBinding({ ...session, sessionBuyerId: undefined })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a session whose metadata has no product, or a request with no product", () => {
    expect(decideCheckoutSessionBinding({ ...session, sessionProductId: undefined })).toMatchObject({ ok: false, status: 403 });
    expect(decideCheckoutSessionBinding({ ...session, requestedProductId: undefined })).toMatchObject({ ok: false, status: 403 });
  });
});

describe("signed URL issuers: wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("get-download-urls checks the order state and no longer trusts the purchase row alone", () => {
    const source = read("get-download-urls/index.ts");
    expect(source).toContain("orderGrantsFiles(order.status)");
    expect(source).toContain('.in("status", [...ENTITLED_ORDER_STATUSES])');
    expect(source).toContain("decideLegacyPurchase({");
    expect(source.indexOf("decideLegacyPurchase({")).toBeLessThan(source.indexOf(".createSignedUrl("));
  });

  it("complete-product-purchase binds the session before it looks up the product or writes anything", () => {
    const source = read("complete-product-purchase/index.ts");
    const binding = source.indexOf("decideCheckoutSessionBinding({");
    expect(binding).toBeGreaterThan(-1);
    expect(binding).toBeLessThan(source.indexOf(".from('digital_products')"));
    expect(binding).toBeLessThan(source.indexOf(".from('marketplace_orders')"));
    expect(binding).toBeLessThan(source.indexOf(".createSignedUrl("));
  });

  it("generate-studio-image proves accepted operator access before the quota is spent or the model is called", () => {
    const source = read("generate-studio-image/index.ts");
    const access = source.indexOf("requireProjectAccess(admin, projectId, user.id");
    expect(access).toBeGreaterThan(-1);
    expect(access).toBeLessThan(source.indexOf("checkAndConsumeStudioAIGeneration(admin"));
    expect(access).toBeLessThan(source.indexOf("ai.gateway.lovable.dev"));
    expect(source).not.toContain('.from("project_collaborators")');
  });

  it("generate-deal-memo hands out a one-hour link, not a seven-day one", () => {
    const source = read("generate-deal-memo/index.ts");
    expect(source).toContain('.createSignedUrl(path, 60 * 60)');
    expect(source).not.toContain("60 * 60 * 24 * 7");
  });
});
