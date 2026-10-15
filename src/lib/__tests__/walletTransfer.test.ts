import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TRANSFER_AMOUNT,
  cleanNote,
  cleanTransferAmount,
  limitCurrency,
} from "../../../supabase/functions/_shared/walletTransfer";

// The currency labels the transfer dialog offers.
const UI_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "BRL", "ZAR", "INR", "NGN", "IDR", "TTD", "AED", "KES"];

describe("cleanTransferAmount: allowed", () => {
  it("accepts whole amounts, cents and the ceiling", () => {
    expect(cleanTransferAmount(5)).toEqual({ ok: true, amount: 5, cents: 500 });
    expect(cleanTransferAmount(19.99)).toEqual({ ok: true, amount: 19.99, cents: 1999 });
    expect(cleanTransferAmount(0.01)).toEqual({ ok: true, amount: 0.01, cents: 1 });
    expect(cleanTransferAmount(750)).toMatchObject({ ok: true, cents: 75000 });
    expect(cleanTransferAmount(MAX_TRANSFER_AMOUNT)).toMatchObject({ ok: true });
  });

  it("tolerates floating-point noise from arithmetic and returns the clean value", () => {
    expect(cleanTransferAmount(0.1 + 0.2)).toEqual({ ok: true, amount: 0.3, cents: 30 });
  });
});

describe("cleanTransferAmount: denied", () => {
  it("refuses a third decimal, the sub-cent rounding trick", () => {
    for (const v of [0.005, 0.015, 0.001, 0.004, 1.005, 10.999, 19.991]) {
      expect(cleanTransferAmount(v)).toMatchObject({ ok: false });
    }
  });

  it("refuses zero, negatives, non-finite numbers and anything above the ceiling", () => {
    for (const v of [0, -1, -0.01, NaN, Infinity, -Infinity, MAX_TRANSFER_AMOUNT + 0.01, 1e21, 2 ** 53]) {
      expect(cleanTransferAmount(v)).toMatchObject({ ok: false });
    }
  });

  it("refuses anything that is not a number, numeric strings included", () => {
    for (const v of ["5", "5.00", "", "abc", null, undefined, {}, [5], true, "1e3"]) {
      expect(cleanTransferAmount(v)).toMatchObject({ ok: false });
    }
  });
});

describe("limitCurrency", () => {
  it("keeps TTD, in any case or padding", () => {
    for (const v of ["TTD", "ttd", " Ttd ", "TTD\n"]) expect(limitCurrency(v)).toBe("TTD");
  });

  it("puts every other label, and anything that is not a string, in the one USD bucket", () => {
    for (const v of ["USD", "usd", "EUR", "JPY", "XXA", "XXB", "", " ", null, undefined, 5, {}, ["TTD"]]) {
      expect(limitCurrency(v)).toBe("USD");
    }
  });

  it("the thirteen non-TTD labels of the dialog cannot be used to open separate daily totals", () => {
    const buckets = new Set(UI_CURRENCIES.filter((c) => c !== "TTD").map((c) => limitCurrency(c)));
    expect([...buckets]).toEqual(["USD"]);
  });

  it("invented labels cannot be used either", () => {
    const buckets = new Set(Array.from({ length: 200 }, (_, i) => limitCurrency(`X${i}`)));
    expect([...buckets]).toEqual(["USD"]);
  });
});

describe("cleanNote", () => {
  it("trims, clips and drops what is not text", () => {
    expect(cleanNote("  lunch  ")).toBe("lunch");
    expect(cleanNote("a".repeat(MAX_NOTE_LENGTH + 50))).toHaveLength(MAX_NOTE_LENGTH);
    for (const v of ["", "   ", null, undefined, 5, {}, ["x"]]) expect(cleanNote(v)).toBeUndefined();
  });
});

describe("wallet-transfer wiring", () => {
  const src = readFileSync(resolve(__dirname, "../../../supabase/functions/wallet-transfer/index.ts"), "utf8");
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it("imports the shared checks and refuses a missing Authorization header cleanly", () => {
    expect(src).toContain('from "../_shared/walletTransfer.ts"');
    expect(src).not.toContain('get("Authorization")!');
    expect(at('if (!authHeader) throw new Error("User not authenticated")')).toBeLessThan(at("auth.getUser(token)"));
  });

  it("checks the amount and the currency bucket before the reservation, the limit check and any money moves", () => {
    const checked = at("cleanTransferAmount(body.amount)");
    expect(checked).toBeLessThan(at('from("wallet_transfers")'));
    expect(checked).toBeLessThan(at('rpc("check_transfer_limit"'));
    expect(checked).toBeLessThan(at('rpc("wallet_debit"'));
    expect(at("limitCurrency(body.currency)")).toBeLessThan(at('rpc("check_transfer_limit"'));
  });

  it("does not read the amount or the currency from the request body anywhere else", () => {
    expect(src).not.toMatch(/const \{[^}]*\bamount\b[^}]*\} = (await req\.json\(\)|body)/);
    expect(src.match(/body\.currency/g)?.length).toBe(1);
    expect(src.match(/body\.amount/g)?.length).toBe(1);
  });

  it("bounds the idempotency key", () => {
    expect(src).toContain("MAX_IDEMPOTENCY_KEY_LENGTH");
    expect(MAX_IDEMPOTENCY_KEY_LENGTH).toBeGreaterThan(0);
    expect(src).toContain('throw new Error("Invalid idempotency key")');
  });

  it("logs a failed refund instead of swallowing it", () => {
    expect(src).toContain("ROLLBACK FAILED");
  });

  it("leaves the debit, the credit and the limit check as they were", () => {
    expect(src).toContain('rpc("wallet_debit", { p_user_id: user.id, p_amount: amount })');
    expect(src).toContain('rpc("wallet_credit", { p_user_id: recipientId, p_amount: amount })');
    expect(src).toContain("p_currency: currency.toUpperCase()");
    expect(src).toContain('reserveError.code === "23505"');
  });
});
