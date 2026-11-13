import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isProviderConfirmedPaid, isSelfReportedPaid, paidProvenanceNote } from "../invoiceProvenance";

const root = (rel: string) => readFileSync(resolve(__dirname, "../../..", rel), "utf8");

describe("provenance of a paid invoice", () => {
  it("a paid invoice with a provider reference is provider-confirmed", () => {
    const inv = { status: "paid", stripe_payment_intent_id: "pi_123" };
    expect(isProviderConfirmedPaid(inv)).toBe(true);
    expect(isSelfReportedPaid(inv)).toBe(false);
  });

  it("a paid invoice without one is self-reported: the issuer's own word", () => {
    for (const ref of [null, undefined, "", "   "]) {
      const inv = { status: "paid", stripe_payment_intent_id: ref };
      expect(isProviderConfirmedPaid(inv)).toBe(false);
      expect(isSelfReportedPaid(inv)).toBe(true);
    }
    expect(isSelfReportedPaid({ status: " PAID " })).toBe(true);
  });

  it("an invoice that is not paid is neither", () => {
    for (const status of ["draft", "sent", "overdue", "cancelled", null, undefined, ""]) {
      expect(isProviderConfirmedPaid({ status, stripe_payment_intent_id: "pi_123" })).toBe(false);
      expect(isSelfReportedPaid({ status, stripe_payment_intent_id: "pi_123" })).toBe(false);
    }
  });

  it("a reference that is not a string is not a reference", () => {
    expect(isProviderConfirmedPaid({ status: "paid", stripe_payment_intent_id: 123 as unknown as string })).toBe(false);
    expect(isSelfReportedPaid({ status: "paid", stripe_payment_intent_id: {} as unknown as string })).toBe(true);
  });
});

describe("the webhook records a confirmed payment or says it could not", () => {
  const source = root("supabase/functions/stripe-marketplace-webhook/index.ts");

  it("checks the error of the invoice update and answers non-2xx so Stripe retries (after giving the ledger row back, see webhookLedger.test.ts)", () => {
    const update = source.indexOf("const { error: invoicePaidErr } = await supabaseAdmin");
    const guard = source.indexOf("if (invoicePaidErr)");
    const ok = source.indexOf('logStep("Invoice marked paid"');
    expect(update).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(update);
    expect(ok).toBeGreaterThan(guard);
    expect(source).toMatch(/if \(invoicePaidErr\) \{[\s\S]{0,500}status: 500/);
  });

  it("still writes the provider reference, and only on a paid session", () => {
    expect(source).toContain("stripe_payment_intent_id: session.payment_intent as string");
    expect(source).toMatch(/kind === "invoice" && session\.payment_status === "paid"/);
  });
});

describe("public trust signals count only provider-confirmed invoices", () => {
  it("BookedThisMonthChip filters on the provider reference", () => {
    const s = root("src/components/passport/BookedThisMonthChip.tsx");
    expect(s).toContain('.not("stripe_payment_intent_id", "is", null)');
    expect(s).toContain('.eq("issued_by", userId)');
  });

  it("HireMeTrustBar filters on the issuer, which exists, and on the provider reference", () => {
    const s = root("src/components/passport/HireMeTrustBar.tsx");
    expect(s).not.toContain('.eq("creator_id", userId)');
    expect(s).toContain('.eq("issued_by", userId)');
    expect(s).toContain('.not("stripe_payment_intent_id", "is", null)');
  });

  it("the invoice list labels a paid invoice the issuer recorded, for whoever is looking", () => {
    const s = root("src/components/project/InvoiceGenerator.tsx");
    expect(s).toContain("paidProvenanceNote(inv, user?.id)");
    expect(s).toContain("· {paidNote.short}");
  });

  it.each([
    ["src/components/project/studio/MoneySection.tsx", "paidProvenanceNote(invoice, user?.id)"],
    ["src/components/project/finance/FinanceHub.tsx", "paidProvenanceNote(inv, currentUserId)"],
  ])("%s shows who vouches for a paid invoice, and reads the reference without naming it", (file, call) => {
    const s = root(file);
    expect(s).toContain(call);
    // Naming stripe_payment_intent_id in a select fails until the migration is applied; "*" works before and after.
    expect(s).not.toMatch(/\.select\([^)]*stripe_payment_intent_id/);
    expect(s).toMatch(/\.from\("invoices"\)\s*(\/\/[^\n]*\s*)*\.select\("\*"\)/);
  });
});

describe("paidProvenanceNote: whose word a paid invoice rests on", () => {
  const manual = { status: "paid", stripe_payment_intent_id: null, issued_by: "issuer-1" };

  it("tells the issuer it is their own record, and anyone else that it is the issuer's", () => {
    expect(paidProvenanceNote(manual, "issuer-1")).toEqual({ short: "self-reported", detail: "Marked paid by you; no payment provider confirmed it" });
    expect(paidProvenanceNote(manual, "client-9")?.short).toBe("recorded by the issuer");
    expect(paidProvenanceNote(manual, null)?.short).toBe("recorded by the issuer");
    expect(paidProvenanceNote({ status: "paid" }, "issuer-1")?.short).toBe("recorded by the issuer");
  });

  it("says nothing for a provider-confirmed or unpaid invoice", () => {
    expect(paidProvenanceNote({ ...manual, stripe_payment_intent_id: "pi_1" }, "client-9")).toBeNull();
    expect(paidProvenanceNote({ ...manual, status: "sent" }, "client-9")).toBeNull();
  });
});

describe("the migration (a reviewed file, not applied)", () => {
  const sql = root("supabase/migrations/20261015100000_invoices_provider_reference.sql");
  const code = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("adds the one nullable column and revokes client writes to it", () => {
    expect(code).toContain("ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text");
    expect(code).toContain("REVOKE UPDATE (stripe_payment_intent_id) ON public.invoices FROM authenticated, anon");
    // Nullable and without a default: the statement ends right after the type.
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text\s*;/);
  });

  it("blocks an API caller from inserting an invoice that is paid, dated paid or referenced", () => {
    expect(code).toContain("COALESCE(auth.role(), '') IN ('authenticated', 'anon')");
    expect(code).toContain("NEW.status = 'paid'");
    expect(code).toContain("NEW.paid_at IS NOT NULL");
    expect(code).toContain("NEW.stripe_payment_intent_id IS NOT NULL");
    expect(code).toContain("BEFORE INSERT ON public.invoices");
  });

  it("changes no policy, grant to clients, data or other table", () => {
    expect(code).not.toMatch(/CREATE POLICY|DROP POLICY|ALTER POLICY/i);
    expect(code).not.toMatch(/\bGRANT\b/i);
    expect(code).not.toMatch(/\bUPDATE public\.|\bDELETE FROM\b|\bINSERT INTO\b|\bTRUNCATE\b|DROP TABLE|DROP COLUMN/i);
  });

  it("does not stop the client's own inserts: they only ever send status draft", () => {
    expect(root("src/components/project/InvoiceGenerator.tsx")).toMatch(/status: "draft"/);
    expect(root("src/components/project/finance/PaymentRequestsReview.tsx")).toMatch(/status: "draft"/);
  });
});
