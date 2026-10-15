import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_IDEMPOTENCY_KEY_LENGTH,
  cleanPayoutRequest,
} from "../../../supabase/functions/_shared/payoutRequest";
import {
  MAX_DISPUTE_REASON_LENGTH,
  parseEscrowAction,
} from "../../../supabase/functions/_shared/escrowOrderAction";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

describe("cleanPayoutRequest: allowed", () => {
  it("accepts whole cents, a three-letter currency, and normalises them", () => {
    expect(cleanPayoutRequest({ amount_cents: 2500, currency: "USD", idempotencyKey: "k-1" })).toEqual({
      ok: true,
      request: { amountCents: 2500, currency: "usd", method: "standard", idempotencyKey: "k-1" },
    });
    expect(cleanPayoutRequest({ amount_cents: 1, currency: " ttd ", method: "instant" })).toEqual({
      ok: true,
      request: { amountCents: 1, currency: "ttd", method: "instant", idempotencyKey: null },
    });
  });

  it("a missing key is allowed (the function then generates one)", () => {
    for (const idempotencyKey of [undefined, null, ""]) {
      expect(cleanPayoutRequest({ amount_cents: 100, currency: "usd", idempotencyKey })).toMatchObject({
        ok: true,
        request: { idempotencyKey: null },
      });
    }
  });

  it("any method that is not 'instant' is standard", () => {
    for (const method of ["standard", "weird", 5, null, undefined]) {
      expect(cleanPayoutRequest({ amount_cents: 100, currency: "usd", method })).toMatchObject({
        ok: true,
        request: { method: "standard" },
      });
    }
  });
});

describe("cleanPayoutRequest: denied", () => {
  it("refuses an amount that is not a positive whole number of cents", () => {
    for (const amount_cents of [0, -1, 1.5, 0.5, NaN, Infinity, "500", "", null, undefined, {}, [100], true, 2 ** 60]) {
      expect(cleanPayoutRequest({ amount_cents, currency: "usd" })).toEqual({ ok: false, error: "Invalid amount or currency" });
    }
  });

  it("refuses a currency that is not three letters", () => {
    for (const currency of ["", "us", "usdd", "u$d", "123", null, undefined, 5, {}, ["usd"]]) {
      expect(cleanPayoutRequest({ amount_cents: 100, currency })).toEqual({ ok: false, error: "Invalid amount or currency" });
    }
  });

  it("refuses an idempotency key that is not text or is too long, instead of replacing it", () => {
    for (const idempotencyKey of [5, {}, ["a"], true, "x".repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1)]) {
      expect(cleanPayoutRequest({ amount_cents: 100, currency: "usd", idempotencyKey })).toEqual({
        ok: false,
        error: "Invalid idempotency key",
      });
    }
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, "x", 5, []]) {
      expect(cleanPayoutRequest(body)).toMatchObject({ ok: false });
    }
  });
});

describe("parseEscrowAction", () => {
  it("accepts a confirmation", () => {
    expect(parseEscrowAction({ orderId: "o1", action: "confirm" })).toEqual({ ok: true, orderId: "o1", action: "confirm" });
  });

  it("accepts a dispute with a reason, trimmed and clipped", () => {
    expect(parseEscrowAction({ orderId: "o1", action: "dispute", reason: "  never arrived  " })).toEqual({
      ok: true,
      orderId: "o1",
      action: "dispute",
      reason: "never arrived",
    });
    const long = parseEscrowAction({ orderId: "o1", action: "dispute", reason: "x".repeat(MAX_DISPUTE_REASON_LENGTH + 500) });
    expect(long).toMatchObject({ ok: true });
    expect((long as { reason: string }).reason).toHaveLength(MAX_DISPUTE_REASON_LENGTH);
  });

  it("refuses a missing or non-text order id or action", () => {
    for (const body of [{}, { orderId: "o1" }, { action: "confirm" }, { orderId: 5, action: "confirm" }, { orderId: "", action: "confirm" }, { orderId: "o1", action: {} }]) {
      expect(parseEscrowAction(body)).toEqual({ ok: false, error: "orderId and action required" });
    }
  });

  it("refuses a dispute whose reason is missing, blank or not text", () => {
    for (const reason of [undefined, null, "", "   ", 5, {}, ["x"], true]) {
      expect(parseEscrowAction({ orderId: "o1", action: "dispute", reason })).toEqual({
        ok: false,
        error: "Dispute reason is required",
      });
    }
  });

  it("refuses any other action", () => {
    for (const action of ["refund", "release", "CONFIRM", "capture"]) {
      expect(parseEscrowAction({ orderId: "o1", action })).toEqual({
        ok: false,
        error: "Invalid action. Use 'confirm' or 'dispute'.",
      });
    }
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, "x", 5]) {
      expect(parseEscrowAction(body)).toMatchObject({ ok: false });
    }
  });
});

describe("wallet-payout wiring", () => {
  const src = read("supabase/functions/wallet-payout/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("checks the request before reading the wallet or calling Stripe", () => {
    expect(src).toContain('from "../_shared/payoutRequest.ts"');
    expect(at("cleanPayoutRequest(")).toBeLessThan(at('from("creator_wallets")'));
    expect(at("cleanPayoutRequest(")).toBeLessThan(at("payouts.create("));
    expect(src).not.toContain("Math.round(amount_cents)");
  });

  it("uses the checked values and keeps the connected-account scoping", () => {
    expect(src).toContain("amount: amountCents,");
    expect(src).toContain("stripeAccount: wallet.stripe_account_id");
    expect(src).toContain("idempotencyKey: idempotencyKey ?? crypto.randomUUID()");
    expect(src).toContain('.eq("user_id", user.id)');
  });

  it("does not hide a payout that could not be recorded", () => {
    expect(src).toContain("PAYOUT CREATED BUT NOT RECORDED");
    expect(src).toContain("if (recordError)");
  });
});

describe("release-escrow wiring", () => {
  const src = read("supabase/functions/release-escrow/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("parses the request through the shared check and refuses a missing header cleanly", () => {
    expect(src).toContain('from "../_shared/escrowOrderAction.ts"');
    expect(src).not.toContain('get("Authorization")!');
    expect(src).not.toMatch(/const \{ orderId, action, reason \} = await req\.json\(\)/);
  });

  it("keeps the buyer-only and in-escrow gates before any Stripe call", () => {
    expect(at("order.buyer_id !== user.id")).toBeLessThan(at("paymentIntents.capture("));
    expect(at('order.status !== "escrow"')).toBeLessThan(at("paymentIntents.capture("));
  });

  it("only moves an order that is still in escrow, and reads the result", () => {
    expect(src.match(/\.eq\("status", "escrow"\)\s*\n\s*\.select\("id"\)/g)?.length).toBe(2);
    expect(src).toContain("if (releaseError || !released?.length)");
    expect(src).toContain("if (!disputed?.length)");
  });

  it("uses the validated reason, never the raw body", () => {
    expect(src).toContain('parsed.action === "dispute" ? parsed.reason : ""');
    expect(src).toContain("reason.substring(0, 100)");
  });
});
