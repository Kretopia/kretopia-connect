import { describe, expect, it } from "vitest";
import {
  decideInvoiceSend,
  formatMoney,
  isUuid,
  renderInvoiceEmail,
  SENDABLE_STATUSES,
  type InvoiceForEmail,
} from "../../../supabase/functions/_shared/invoiceEmail";

const ID = "3f2b8a64-5b7c-4c0e-9d8a-1a2b3c4d5e6f";
const ISSUER = "issuer-1";
const base = (over: Partial<InvoiceForEmail> = {}): InvoiceForEmail => ({
  id: ID,
  invoice_number: "INV-2026-001",
  brand_name: "Studio Nord",
  brand_email: "billing@studio-nord.test",
  recipient_name: "Client SAS",
  due_date: "2026-11-30T00:00:00Z",
  status: "draft",
  line_items: [{ description: "Colour grade", quantity: 2, rate: 150, amount: 300 }],
  amount: 300,
  tax_rate: 20,
  tax_amount: 60,
  total_amount: 360,
  currency: "USD",
  notes: "Thank you",
  ...over,
});

describe("decideInvoiceSend: only the issuer sends, and only an open invoice", () => {
  it("lets the issuer send a draft, and marks only a draft as sent", () => {
    expect(decideInvoiceSend({ issued_by: ISSUER, status: "draft" }, ISSUER)).toEqual({ ok: true, markSent: true });
    for (const status of ["sent", "overdue", "accepted"]) {
      expect(decideInvoiceSend({ issued_by: ISSUER, status }, ISSUER)).toEqual({ ok: true, markSent: false });
    }
  });

  it("refuses a paid or cancelled invoice: it is never mailed again with a payment button", () => {
    for (const status of ["paid", "cancelled"]) {
      expect(decideInvoiceSend({ issued_by: ISSUER, status }, ISSUER)).toMatchObject({ ok: false, status: 409, reason: "not_sendable" });
    }
    expect(decideInvoiceSend({ issued_by: ISSUER, status: "mystery" }, ISSUER)).toMatchObject({ ok: false, status: 409 });
    expect(decideInvoiceSend({ issued_by: ISSUER }, ISSUER)).toMatchObject({ ok: false, status: 409 });
  });

  it("answers a stranger exactly as it answers a missing invoice", () => {
    const stranger = decideInvoiceSend({ issued_by: "someone-else", status: "draft" }, ISSUER);
    expect(stranger).toEqual(decideInvoiceSend(null, ISSUER));
    expect(stranger).toMatchObject({ ok: false, status: 404, reason: "not_found" });
    expect(decideInvoiceSend(undefined, ISSUER)).toMatchObject({ status: 404 });
  });

  it("does not let the issuer id be matched loosely", () => {
    expect(decideInvoiceSend({ issued_by: null, status: "draft" }, ISSUER)).toMatchObject({ ok: false, status: 404 });
    expect(decideInvoiceSend({ issued_by: ISSUER.toUpperCase(), status: "draft" }, ISSUER)).toMatchObject({ ok: false, status: 404 });
  });

  it("lists exactly the open statuses", () => {
    expect([...SENDABLE_STATUSES].sort()).toEqual(["accepted", "draft", "overdue", "sent"]);
  });
});

describe("formatMoney", () => {
  it("prints dollars with a sign and other currencies with their code", () => {
    expect(formatMoney(12.5, "USD")).toBe("$12.50");
    expect(formatMoney(1234, "eur")).toBe("EUR 1234.00");
    expect(formatMoney("99.9", "GBP")).toBe("GBP 99.90");
  });

  it("never prints NaN or markup: a bad amount is 0.00 and a bad currency is USD", () => {
    expect(formatMoney(undefined, "USD")).toBe("$0.00");
    expect(formatMoney("<b>", "USD")).toBe("$0.00");
    expect(formatMoney(Infinity, "USD")).toBe("$0.00");
    expect(formatMoney(5, "<script>")).toBe("$5.00");
    expect(formatMoney(5, null)).toBe("$5.00");
  });
});

describe("renderInvoiceEmail: nothing the issuer typed becomes markup", () => {
  const evil = '"><script>alert(1)</script><a href="https://evil.test/pay">Pay here</a>&';

  it("escapes every issuer-controlled field, in the body and in the title", () => {
    const { html } = renderInvoiceEmail(
      base({
        invoice_number: evil,
        brand_name: evil,
        brand_email: evil,
        recipient_name: evil,
        notes: evil,
        status: evil,
        line_items: [{ description: evil, quantity: evil, rate: evil, amount: evil }],
      }),
      evil,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain('<a href="https://evil.test/pay">');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    // The only link in the mail is ours.
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain(`href="https://www.kretopia.com/pay/invoice/${ID}?t=`);
  });

  it("keeps the subject on one line", () => {
    const { subject } = renderInvoiceEmail(base({ invoice_number: "A\r\nBcc: victim@x.test", brand_name: "Brand\nInjected: header" }), "c@x.test");
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject.length).toBeLessThanOrEqual(150);
  });

  it("offers the pay button for an open invoice with a real id, and for nothing else", () => {
    expect(renderInvoiceEmail(base(), "c@x.test").html).toContain("/pay/invoice/");
    expect(renderInvoiceEmail(base({ status: "paid" }), "c@x.test").html).not.toContain("/pay/invoice/");
    expect(renderInvoiceEmail(base({ id: "not-a-uuid" }), "c@x.test").html).not.toContain("/pay/invoice/");
    expect(renderInvoiceEmail(base({ id: `${ID}"onmouseover="x` }), "c@x.test").html).not.toContain("onmouseover");
  });

  it("shows the totals in the invoice's currency, with the tax line only when there is tax", () => {
    const eur = renderInvoiceEmail(base({ currency: "EUR" }), "c@x.test").html;
    expect(eur).toContain("EUR 360.00");
    expect(eur).toContain("Tax (20%)");
    const none = renderInvoiceEmail(base({ tax_rate: 0 }), "c@x.test").html;
    expect(none).not.toContain("Tax (");
  });

  it("survives malformed stored data instead of throwing", () => {
    for (const line_items of [null, "x", 5, [null, "x", 3, {}], { a: 1 }]) {
      expect(() => renderInvoiceEmail(base({ line_items }), "c@x.test")).not.toThrow();
    }
    expect(() => renderInvoiceEmail(base({ due_date: "not a date", amount: "x", total_amount: null }), "c@x.test")).not.toThrow();
    expect(renderInvoiceEmail(base({ due_date: "not a date" }), "c@x.test").html).not.toContain("Due Date");
  });

  it("caps the size of what it renders", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ description: `item ${i}`, quantity: 1, rate: 1, amount: 1 }));
    const html = renderInvoiceEmail(base({ line_items: many, notes: "n".repeat(10_000) }), "c@x.test").html;
    expect(html.match(/<tr>\s*<td/g)?.length).toBe(100);
    expect(html).not.toContain("n".repeat(2001));
  });
});

describe("isUuid", () => {
  it("accepts a uuid and nothing that could carry markup or a path", () => {
    expect(isUuid(ID)).toBe(true);
    for (const bad of ["", "abc", `${ID} `, `${ID}"`, `../${ID}`, 5, null, undefined, {}]) expect(isUuid(bad)).toBe(false);
  });
});
