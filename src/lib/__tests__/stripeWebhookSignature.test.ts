import { describe, it, expect } from "vitest";
import {
  buildSignatureHeader,
  verifyStripeSignature,
  EventLedger,
} from "../../../supabase/functions/_shared/stripeSignature";

// NOTE: These tests never contact Stripe and never use a real Stripe key.
// The "endpoint secrets" below are local fixtures only.
const SECRET = "whsec_test_fixture_primary_0000000000";
const OTHER_SECRET = "whsec_test_fixture_other_1111111111";

const event = (id: string, type = "payment_intent.succeeded", created = 1_700_000_000) =>
  JSON.stringify({ id, object: "event", type, created, data: { object: { id: "pi_fixture", amount: 100 } } });

const NOW = 1_700_000_000;

describe("stripe webhook signature verification", () => {
  it("accepts a valid signature fixture", async () => {
    const body = event("evt_valid_1");
    const header = await buildSignatureHeader(body, SECRET, NOW);
    const res = await verifyStripeSignature(body, header, SECRET, 300, NOW);
    expect(res.ok).toBe(true);
  });

  it("rejects a missing signature header (fails closed)", async () => {
    const res = await verifyStripeSignature(event("evt_x"), null, SECRET, 300, NOW);
    expect(res).toEqual({ ok: false, reason: "missing_signature_header" });
  });

  it("rejects an invalid / malformed signature", async () => {
    const body = event("evt_bad");
    expect(await verifyStripeSignature(body, "garbage", SECRET, 300, NOW)).toEqual({
      ok: false,
      reason: "malformed_signature_header",
    });
    expect(await verifyStripeSignature(body, `t=${NOW},v1=deadbeef`, SECRET, 300, NOW)).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
  });

  it("rejects an altered body signed with the correct secret", async () => {
    const original = event("evt_altered");
    const header = await buildSignatureHeader(original, SECRET, NOW);
    const tampered = original.replace('"amount":100', '"amount":1000000');
    const res = await verifyStripeSignature(tampered, header, SECRET, 300, NOW);
    expect(res).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a payload signed with the wrong endpoint secret", async () => {
    const body = event("evt_wrong_secret");
    const header = await buildSignatureHeader(body, OTHER_SECRET, NOW);
    const res = await verifyStripeSignature(body, header, SECRET, 300, NOW);
    expect(res).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a replayed event outside the timestamp tolerance", async () => {
    const body = event("evt_replay");
    const oldTs = NOW - 3600;
    const header = await buildSignatureHeader(body, SECRET, oldTs);
    // Signature itself is valid, but the timestamp is stale -> replay rejected.
    const res = await verifyStripeSignature(body, header, SECRET, 300, NOW);
    expect(res).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
  });
});

describe("stripe webhook event deduplication", () => {
  it("processes a new event once and ignores duplicate event IDs", () => {
    const ledger = new EventLedger();
    expect(ledger.record("evt_dupe", "payment_intent.succeeded")).toBe(true);
    expect(ledger.record("evt_dupe", "payment_intent.succeeded")).toBe(false);
    expect(ledger.size).toBe(1);
  });

  it("treats a safe retry of the same event as a no-op success", async () => {
    const ledger = new EventLedger();
    const body = event("evt_retry");
    const header = await buildSignatureHeader(body, SECRET, NOW);

    const deliver = async () => {
      const res = await verifyStripeSignature(body, header, SECRET, 300, NOW);
      if (!res.ok) return "rejected" as const;
      return ledger.record("evt_retry", "payment_intent.succeeded") ? "processed" : "skipped";
    };

    expect(await deliver()).toBe("processed");
    expect(await deliver()).toBe("skipped");
    expect(await deliver()).toBe("skipped");
    expect(ledger.size).toBe(1);
  });

  it("handles out-of-order delivery without double-processing", () => {
    const ledger = new EventLedger();
    // Stripe may deliver `payment_intent.succeeded` after `charge.refunded`.
    expect(ledger.record("evt_refund", "charge.refunded", 2)).toBe(true);
    expect(ledger.record("evt_succeeded", "payment_intent.succeeded", 1)).toBe(true);
    // Re-delivery of either, in any order, is a no-op.
    expect(ledger.record("evt_succeeded", "payment_intent.succeeded", 3)).toBe(false);
    expect(ledger.record("evt_refund", "charge.refunded", 4)).toBe(false);
    expect(ledger.size).toBe(2);
  });
});
