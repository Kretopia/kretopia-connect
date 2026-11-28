// One vocabulary for "where is this money?", shared by every KrePay surface. A status never claims more than its source can vouch
// for: "Paid" needs a provider confirmation; an issuer's own record reads as such; a browser redirect is never an input here.

export type LedgerTone = "neutral" | "info" | "warn" | "danger" | "success";

export interface LedgerStatus {
  key: "draft" | "sent" | "overdue" | "pending_review" | "provider_confirmed" | "recorded_by_issuer" | "failed" | "cancelled" | "unknown";
  label: string;
  tone: LedgerTone;
  /** The sentence for a tooltip or a screen reader. */
  detail: string;
}

export interface LedgerInvoiceFields {
  status?: string | null;
  due_date?: string | null;
  stripe_payment_intent_id?: string | null;
  /** A bank-transfer or manual payment request waiting for the issuer's review. */
  pending_manual_review?: boolean;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function invoiceLedgerStatus(inv: LedgerInvoiceFields, now: Date = new Date()): LedgerStatus {
  const status = norm(inv.status);
  const providerRef = typeof inv.stripe_payment_intent_id === "string" && inv.stripe_payment_intent_id.trim().length > 0;
  if (status === "paid") {
    return providerRef
      ? { key: "provider_confirmed", label: "Confirmed by provider", tone: "success", detail: "A payment provider confirmed this payment." }
      : { key: "recorded_by_issuer", label: "Recorded as paid", tone: "info", detail: "The issuer recorded this as paid; no payment provider confirmed it." };
  }
  if (status === "cancelled" || status === "canceled" || status === "void") return { key: "cancelled", label: "Cancelled", tone: "neutral", detail: "This invoice was cancelled." };
  if (status === "failed" || status === "payment_failed") return { key: "failed", label: "Payment failed", tone: "danger", detail: "The payment did not go through." };
  if (inv.pending_manual_review) return { key: "pending_review", label: "Pending manual review", tone: "warn", detail: "A payment was reported and is waiting for the issuer to review it." };
  if (status === "draft") return { key: "draft", label: "Draft", tone: "neutral", detail: "Not sent yet." };
  if (status === "overdue") return { key: "overdue", label: "Overdue", tone: "danger", detail: "The due date has passed and no payment is recorded." };
  if (status === "sent" || status === "viewed") {
    const due = inv.due_date ? Date.parse(inv.due_date) : NaN;
    if (!Number.isNaN(due) && due < now.getTime()) return { key: "overdue", label: "Overdue", tone: "danger", detail: "The due date has passed and no payment is recorded." };
    return { key: "sent", label: status === "viewed" ? "Sent · viewed" : "Sent", tone: "info", detail: "Waiting for payment." };
  }
  return { key: "unknown", label: "Status unknown", tone: "neutral", detail: "This status is not recognised, so nothing is claimed about it." };
}

export const LEDGER_TONE_CLASS: Record<LedgerTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-primary/10 text-primary border-primary/30",
  warn: "bg-energy/15 text-energy-foreground border-energy/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  success: "bg-success/15 text-success border-success/30",
};
