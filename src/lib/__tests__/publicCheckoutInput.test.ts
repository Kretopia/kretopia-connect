import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_CHARGE_CENTS,
  MAX_EMAIL_LENGTH,
  MAX_PAYER_NAME_LENGTH,
  MAX_PAYER_NOTE_LENGTH,
  MAX_SLUG_LENGTH,
  checkInvoicePayable,
  cleanPayerEmail,
  cleanPayerText,
  cleanPaymentLinkRequest,
} from "../../../supabase/functions/_shared/publicCheckoutInput";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

describe("checkInvoicePayable", () => {
  const ok = { status: "sent", document_type: "invoice", total_amount: 250 };

  it("an invoice that was sent or is overdue is payable, in whole cents", () => {
    expect(checkInvoicePayable(ok)).toEqual({ ok: true, cents: 25000 });
    expect(checkInvoicePayable({ ...ok, status: "overdue", total_amount: "99.99" })).toEqual({ ok: true, cents: 9999 });
    expect(checkInvoicePayable({ ...ok, status: "draft" })).toMatchObject({ ok: true });
  });

  it("a cancelled invoice is not payable by whoever holds its link", () => {
    expect(checkInvoicePayable({ ...ok, status: "cancelled" })).toEqual({ ok: false, error: "This invoice was cancelled" });
  });

  it("a paid invoice and a quote are refused with the messages they always had", () => {
    expect(checkInvoicePayable({ ...ok, status: "paid" })).toEqual({ ok: false, error: "Invoice already paid" });
    expect(checkInvoicePayable({ ...ok, document_type: "quote" })).toEqual({ ok: false, error: "Quotes can't be paid" });
  });

  it("an amount Stripe cannot charge is refused: missing, zero, negative, below 50 cents, non-numeric, above the ceiling", () => {
    for (const total_amount of [null, undefined, 0, -10, 0.49, NaN, Infinity, "abc", "", {}, [5], true, MAX_CHARGE_CENTS / 100 + 1]) {
      expect(checkInvoicePayable({ ...ok, total_amount })).toEqual({ ok: false, error: "Invalid amount" });
    }
  });

  it("the cancelled check comes before the amount check", () => {
    expect(checkInvoicePayable({ ...ok, status: "cancelled", total_amount: null })).toMatchObject({ error: "This invoice was cancelled" });
  });
});

describe("cleanPayerEmail", () => {
  it("keeps a plausible email, trimmed", () => {
    expect(cleanPayerEmail("  ada@example.com ")).toBe("ada@example.com");
  });

  it("drops anything else instead of failing the checkout", () => {
    for (const v of ["", "   ", "no-at-sign", "a@b", "a b@c.com", "a@b@c.com", "x".repeat(MAX_EMAIL_LENGTH) + "@x.com", 5, {}, null, undefined, ["a@b.com"]]) {
      expect(cleanPayerEmail(v)).toBeUndefined();
    }
  });
});

describe("cleanPayerText", () => {
  it("trims, clips and removes control characters", () => {
    expect(cleanPayerText("  hello\nworld\u0000  ", 50)).toBe("hello world");
    expect(cleanPayerText("x".repeat(1000), MAX_PAYER_NOTE_LENGTH)).toHaveLength(MAX_PAYER_NOTE_LENGTH);
  });
  it("anything that is not text is empty", () => {
    for (const v of [5, {}, [], null, undefined, true]) expect(cleanPayerText(v, 50)).toBe("");
  });
});

describe("cleanPaymentLinkRequest", () => {
  it("accepts a slug and cleans the payer's details", () => {
    expect(cleanPaymentLinkRequest({ slug: " my-link ", amount_cents: 2500, payer_email: "a@b.co", payer_name: "Ada", payer_note: "thanks" })).toEqual({
      ok: true,
      request: { slug: "my-link", requestedCents: 2500, payerEmail: "a@b.co", payerName: "Ada", payerNote: "thanks" },
    });
  });

  it("reads a numeric string amount, and treats garbage as no amount (an open link then says 'Amount required')", () => {
    expect(cleanPaymentLinkRequest({ slug: "s", amount_cents: "1500" })).toMatchObject({ ok: true, request: { requestedCents: 1500 } });
    for (const amount_cents of ["abc", NaN, Infinity, {}, [5], true, undefined, null]) {
      expect(cleanPaymentLinkRequest({ slug: "s", amount_cents })).toMatchObject({ ok: true, request: { requestedCents: null } });
    }
  });

  it("refuses a missing, non-text or over-long slug", () => {
    for (const slug of [undefined, null, "", "   ", 5, {}, ["a"], "x".repeat(MAX_SLUG_LENGTH + 1)]) {
      expect(cleanPaymentLinkRequest({ slug })).toEqual({ ok: false, error: "slug required" });
    }
  });

  it("bounds what an anonymous payer writes into Stripe metadata and our table", () => {
    const r = cleanPaymentLinkRequest({ slug: "s", payer_name: "n".repeat(1000), payer_note: { evil: true }, payer_email: "bad" });
    expect(r).toMatchObject({ ok: true, request: { payerNote: "", payerEmail: undefined } });
    expect((r as { request: { payerName: string } }).request.payerName).toHaveLength(MAX_PAYER_NAME_LENGTH);
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, "x", 5, []]) expect(cleanPaymentLinkRequest(body)).toMatchObject({ ok: false });
  });
});

describe("create-invoice-checkout wiring", () => {
  const src = read("supabase/functions/create-invoice-checkout/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("refuses a cancelled, paid or unchargeable invoice before it reads the wallet or calls Stripe", () => {
    expect(src).toContain('from "../_shared/publicCheckoutInput.ts"');
    expect(at("checkInvoicePayable(invoice)")).toBeLessThan(at('from("creator_wallets")'));
    expect(at("checkInvoicePayable(invoice)")).toBeLessThan(at("checkout.sessions.create"));
  });

  it("leaves the destination charge, the readiness checks and the idempotency key as they were", () => {
    expect(src).toContain("transfer_data: { destination: wallet.stripe_account_id }");
    expect(src).toContain('account.capabilities?.transfers !== "active"');
    expect(src).toContain("`invoice-checkout:${invoice_id}:${cents}`");
    expect(src).toContain('metadata: { kind: "invoice", invoice_id, recipient_user_id: invoice.issued_by }');
  });
});

describe("create-payment-link-checkout wiring", () => {
  const src = read("supabase/functions/create-payment-link-checkout/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("cleans the anonymous request before any lookup or Stripe call", () => {
    expect(src).toContain('from "../_shared/publicCheckoutInput.ts"');
    expect(at("cleanPaymentLinkRequest(")).toBeLessThan(at('from("payment_links")'));
    expect(at("cleanPaymentLinkRequest(")).toBeLessThan(at("checkout.sessions.create"));
    expect(src).not.toMatch(/const \{[^}]*payer_note[^}]*\} = await req\.json\(\)/);
  });

  it("keeps the link's own bounds, the destination charge and the pending row", () => {
    expect(src).toContain("link.min_amount_cents ?? 100");
    expect(src).toContain("if (requested < min)");
    expect(src).toContain("if (requested > max)");
    expect(src).toContain("transfer_data: { destination: wallet.stripe_account_id }");
    expect(src).toContain('status: "pending"');
  });
});
