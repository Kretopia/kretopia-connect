import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_TOPUP_AMOUNT,
  WALLET_CURRENCY,
  cleanTopupRequest,
  topupCurrencyMatches,
} from "../../../supabase/functions/_shared/walletTopup";
import {
  MAX_HOLDER_NAME_LENGTH,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  cleanBankRequest,
} from "../../../supabase/functions/_shared/bankRequest";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

describe("cleanTopupRequest: allowed", () => {
  it("accepts a USD amount in whole cents, with Stripe as the default gateway", () => {
    expect(cleanTopupRequest({ amount: 25 })).toEqual({ ok: true, amount: 25, cents: 2500, gateway: "stripe" });
    expect(cleanTopupRequest({ amount: 19.99, currency: "USD", gateway: "stripe" })).toEqual({
      ok: true, amount: 19.99, cents: 1999, gateway: "stripe",
    });
    expect(cleanTopupRequest({ amount: 0.01, currency: " usd " })).toMatchObject({ ok: true, cents: 1 });
    expect(cleanTopupRequest({ amount: MAX_TOPUP_AMOUNT })).toMatchObject({ ok: true });
  });

  it("lets WiPay through to the placeholder answer", () => {
    expect(cleanTopupRequest({ amount: 10, gateway: "wipay" })).toMatchObject({ ok: true, gateway: "wipay" });
  });
});

describe("cleanTopupRequest: denied", () => {
  it("refuses every currency but the wallet's own, whatever it is worth", () => {
    for (const currency of ["TTD", "ttd", "EUR", "JPY", "IDR", "VND", "COP", "NGN", "KES", "usdt", "", 5, {}, ["USD"], true]) {
      expect(cleanTopupRequest({ amount: 100, currency })).toEqual({ ok: false, error: "Wallet top-ups are in USD only for now" });
    }
  });

  it("refuses a missing, zero, negative, non-finite or non-numeric amount", () => {
    for (const amount of [undefined, null, 0, -1, NaN, Infinity, "10", "", {}, [10], true]) {
      expect(cleanTopupRequest({ amount })).toEqual({ ok: false, error: "Invalid amount" });
    }
  });

  it("refuses an amount above the ceiling", () => {
    expect(cleanTopupRequest({ amount: MAX_TOPUP_AMOUNT + 0.01 })).toEqual({ ok: false, error: "Maximum top-up amount is $10,000" });
    expect(cleanTopupRequest({ amount: 1e9 })).toMatchObject({ ok: false });
  });

  it("refuses fractions of a cent", () => {
    for (const amount of [0.005, 0.001, 10.001, 99.999, 1.005]) {
      expect(cleanTopupRequest({ amount })).toMatchObject({ ok: false });
    }
  });

  it("refuses an unknown gateway", () => {
    for (const gateway of ["paypal", "STRIPE", 5, {}, ""]) {
      expect(cleanTopupRequest({ amount: 10, gateway })).toEqual({ ok: false, error: "Unsupported payment gateway" });
    }
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, "x", 5, []]) {
      expect(cleanTopupRequest(body)).toMatchObject({ ok: false });
    }
  });
});

describe("topupCurrencyMatches", () => {
  it("only a USD row paid in USD matches", () => {
    expect(topupCurrencyMatches("USD", "usd")).toBe(true);
    expect(topupCurrencyMatches(" usd ", "USD")).toBe(true);
    expect(WALLET_CURRENCY).toBe("USD");
  });

  it("a row or a session in another currency, or an unreadable one, does not", () => {
    for (const [row, session] of [["TTD", "ttd"], ["USD", "eur"], ["EUR", "usd"], ["USD", null], [null, "usd"], [undefined, undefined], ["USD", 5], ["", ""]]) {
      expect(topupCurrencyMatches(row, session)).toBe(false);
    }
  });
});

describe("cleanBankRequest: allowed", () => {
  const us = { country: "us", currency: "usd", account_holder_name: " Ada Lovelace ", account_number: "000123456789", routing_number: "110-000-000" };

  it("normalises a US account", () => {
    expect(cleanBankRequest(us)).toEqual({
      ok: true,
      request: {
        country: "US", currency: "USD", accountHolderName: "Ada Lovelace", accountNumber: "000123456789",
        routingNumber: "110000000", makeDefault: true, idempotencyKey: null,
      },
    });
  });

  it("strips spaces from an IBAN, leaves routing out, and honours make_default and a key", () => {
    expect(cleanBankRequest({ country: "DE", currency: "EUR", account_holder_name: "A B", account_number: "DE89 3704 0044 0532 0130 00", make_default: false, idempotencyKey: "k1" })).toMatchObject({
      ok: true,
      request: { accountNumber: "DE89370400440532013000", routingNumber: null, makeDefault: false, idempotencyKey: "k1" },
    });
  });

  it("accepts a numeric account number", () => {
    expect(cleanBankRequest({ ...us, account_number: 123456789 })).toMatchObject({ ok: true, request: { accountNumber: "123456789" } });
  });
});

describe("cleanBankRequest: denied", () => {
  const ok = { country: "US", currency: "USD", account_holder_name: "Ada", account_number: "000123456789", routing_number: "110000000" };

  it("refuses missing required fields", () => {
    for (const k of ["country", "currency", "account_holder_name", "account_number"]) {
      expect(cleanBankRequest({ ...ok, [k]: undefined })).toMatchObject({ ok: false, code: "invalid_bank_details" });
      expect(cleanBankRequest({ ...ok, [k]: "" })).toMatchObject({ ok: false });
    }
  });

  it("refuses values that are not text, or not the right shape (before any Stripe call)", () => {
    for (const patch of [
      { country: ["US"] }, { country: "USA" }, { country: "U1" },
      { currency: ["USD"] }, { currency: "US" }, { currency: 5 },
      { account_holder_name: {} }, { account_holder_name: 5 },
      { account_number: {} }, { account_number: "12" }, { account_number: "12$45678" }, { account_number: "x".repeat(35) },
      { routing_number: {} }, { routing_number: "12" }, { routing_number: "a$b$c$d" },
    ]) {
      expect(cleanBankRequest({ ...ok, ...patch })).toMatchObject({ ok: false });
    }
  });

  it("refuses an over-long holder name", () => {
    expect(cleanBankRequest({ ...ok, account_holder_name: "x".repeat(MAX_HOLDER_NAME_LENGTH + 1) })).toMatchObject({ ok: false });
  });

  it("refuses make_default that is not a boolean, and a key that is not text or too long", () => {
    for (const make_default of ["true", 1, "yes", {}]) {
      expect(cleanBankRequest({ ...ok, make_default })).toMatchObject({ ok: false });
    }
    for (const idempotencyKey of [5, {}, "x".repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1)]) {
      expect(cleanBankRequest({ ...ok, idempotencyKey })).toMatchObject({ ok: false, error: "Invalid idempotency key" });
    }
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, "x", 5, []]) {
      expect(cleanBankRequest(body)).toMatchObject({ ok: false });
    }
  });
});

describe("wallet-topup wiring", () => {
  const src = read("supabase/functions/wallet-topup/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("checks the request before any row is created or Stripe is called, and charges in the wallet currency only", () => {
    expect(src).toContain('from "../_shared/walletTopup.ts"');
    expect(src).not.toContain('get("Authorization")!');
    expect(at("cleanTopupRequest(")).toBeLessThan(at('from("wallet_topups")'));
    expect(at("cleanTopupRequest(")).toBeLessThan(at("checkout.sessions.create"));
    expect(src).toContain("const currency = WALLET_CURRENCY;");
    expect(src).not.toMatch(/const \{[^}]*currency[^}]*\} = await req\.json\(\)/);
  });

  it("answers WiPay before creating a pending top-up row for it", () => {
    expect(at('gateway === "wipay"')).toBeLessThan(at('from("wallet_topups")'));
  });
});

describe("wallet-topup-confirm wiring", () => {
  const src = read("supabase/functions/wallet-topup-confirm/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("refuses a non-USD top-up before it claims or credits anything", () => {
    expect(src).toContain('from "../_shared/walletTopup.ts"');
    expect(src).not.toContain('get("Authorization")!');
    expect(at("topupCurrencyMatches(topup.currency, session.currency)")).toBeLessThan(at('.neq("status", "completed")'));
    expect(at("topupCurrencyMatches(")).toBeLessThan(at('rpc("wallet_credit"'));
  });

  it("keeps the session, metadata, amount and claim checks", () => {
    expect(src).toContain('session.payment_status !== "paid"');
    expect(src).toContain('session.metadata?.type !== "wallet_topup"');
    expect(src).toContain("session.amount_total !== expectedCents");
    expect(src).toContain('.neq("status", "completed")');
  });

  it("gives a claimed top-up back when the credit fails, instead of leaving it 'completed' and uncredited", () => {
    expect(src).toContain("TOP-UP CLAIMED BUT NOT CREDITED");
    expect(at("if (creditError) {")).toBeGreaterThan(at('rpc("wallet_credit"'));
    expect(src).toContain('.update({ status: topup.status, completed_at: null, gateway_payment_id: null })');
  });
});

describe("wallet-add-bank wiring", () => {
  const src = read("supabase/functions/wallet-add-bank/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("checks every field before the first Stripe call", () => {
    expect(src).toContain('from "../_shared/bankRequest.ts"');
    expect(at("cleanBankRequest(")).toBeLessThan(at("accounts.create("));
    expect(at("cleanBankRequest(")).toBeLessThan(at("accounts.retrieve("));
    expect(src).not.toMatch(/make_default = true,\s*\n\s*idempotencyKey,\s*\n\s*\} = body/);
  });

  it("tells the owner when a payout destination is added, without blocking the request", () => {
    expect(src).toContain('p_title: "Payout bank account added"');
    expect(at('p_title: "Payout bank account added"')).toBeGreaterThan(at('from("creator_payout_methods")'));
    expect(src).toContain("notification failed");
  });

  it("keeps the supported countries, the Connect account creation and the attach as they were", () => {
    expect(src).toContain("const SUPPORTED_COUNTRIES");
    expect(src).toContain('stripe_dashboard: { type: "none" }');
    expect(src).toContain("createExternalAccount(");
    expect(src).toContain("default_for_currency: make_default");
  });
});

describe("WalletTopUpDialog", () => {
  it("no longer offers a currency the wallet does not hold", () => {
    const dialog = read("src/components/wallet/WalletTopUpDialog.tsx");
    expect(dialog).toContain('<SelectItem value="USD">USD</SelectItem>');
    expect(dialog).not.toContain('<SelectItem value="TTD">');
  });
});
