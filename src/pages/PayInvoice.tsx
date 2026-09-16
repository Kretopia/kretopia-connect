import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Lock, ShieldCheck, Landmark, Copy, Check, Clock } from "lucide-react";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";

const fmt = (n: number, cur: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD" }).format(n);

export default function PayInvoice() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const status = sp.get("status");
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "bank">("card");
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(
          `https://kwmcocsitwssrtzkdojh.supabase.co/functions/v1/invoice-pay-info?id=${encodeURIComponent(id)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Invoice not available");
        setInvoice(json.invoice);
      } catch (e: any) {
        setError(e?.message || "Couldn't load invoice");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [id]);

  const handlePay = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-invoice-checkout", {
        body: { invoice_id: id },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Checkout unavailable");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Couldn't start checkout");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked — the reference is still visible to copy manually.
    }
  };

  const handleReportBankTransfer = async () => {
    if (!id) return;
    setReporting(true);
    try {
      const res = await fetch(
        `https://kwmcocsitwssrtzkdojh.supabase.co/functions/v1/invoice-report-bank-transfer`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't report the transfer");
      setInvoice((prev: any) => (prev ? { ...prev, bank_transfer_reported_at: json.reportedAt ?? new Date().toISOString() } : prev));
    } catch (e: any) {
      setError(e?.message || "Couldn't report the transfer");
    } finally {
      setReporting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
        <SEO title="Invoice paid" description="Thanks for your payment" />
        <Card className="max-w-md w-full"><CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-[hsl(var(--energy-lime))] mx-auto" />
          <h1 className="text-2xl font-serif">Invoice paid</h1>
          <p className="text-muted-foreground">Thanks — the sender has been notified.</p>
          <Button asChild className="w-full"><Link to="/">Back to Kretopia</Link></Button>
        </CardContent></Card>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full"><CardContent className="p-8 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">{error}</h1>
        </CardContent></Card>
      </div>
    );
  }
  if (!invoice) return null;

  const total = Number(invoice.total_amount);
  const alreadyPaid = invoice.status === "paid";
  const paymentReported = !alreadyPaid && !!invoice.bank_transfer_reported_at;
  const sepa = invoice.sepa as { beneficiaryName: string; iban: string; bic: string | null; reference: string } | null;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 flex items-center justify-center">
      <SEO title={`Pay invoice ${invoice.invoice_number}`} description={`Invoice from ${invoice.brand_name || "Kretopia"}`} />
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            {invoice.brand_logo_url && <img src={invoice.brand_logo_url} alt="" className="h-12 mx-auto object-contain" />}
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice from</p>
            <p className="font-semibold">{invoice.brand_name || "Kretopia creator"}</p>
          </div>

          <div className="text-center py-4 border-y space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice #{invoice.invoice_number}</p>
            <p className="text-4xl font-bold">{fmt(total, invoice.currency)}</p>
            {invoice.due_date && (
              <p className="text-xs text-muted-foreground">Due {new Date(invoice.due_date).toLocaleDateString()}</p>
            )}
          </div>

          {invoice.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          {alreadyPaid ? (
            <div className="text-center text-sm text-[hsl(var(--energy-lime))] font-medium flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Already paid
            </div>
          ) : paymentReported ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-1.5">
              <Clock className="h-5 w-5 text-amber-500 mx-auto" />
              <p className="text-sm font-medium">Payment pending confirmation</p>
              <p className="text-xs text-muted-foreground">
                We've let {invoice.brand_name || "the sender"} know a transfer is on its way. They'll mark it paid once it arrives — this isn't automatic.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sepa && (
                <div role="tablist" aria-label="Payment method" className="inline-flex w-full rounded-full border p-1 gap-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={payMethod === "card"}
                    onClick={() => setPayMethod("card")}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                      payMethod === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    Pay by card
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={payMethod === "bank"}
                    onClick={() => setPayMethod("bank")}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                      payMethod === "bank" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    Pay by bank transfer
                  </button>
                </div>
              )}

              {payMethod === "bank" && sepa ? (
                <div className="space-y-3">
                  <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Beneficiary</span>
                      <span className="font-medium text-right">{sepa.beneficiaryName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">IBAN</span>
                      <span className="font-mono font-medium text-right break-all">{sepa.iban}</span>
                    </div>
                    {sepa.bic && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">BIC</span>
                        <span className="font-mono font-medium">{sepa.bic}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{fmt(total, invoice.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2 border-t">
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-[11px] block">Reference (required)</span>
                        <span className="font-mono font-semibold">{sepa.reference}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyReference(sepa.reference)}
                        aria-label="Copy payment reference"
                        className="shrink-0"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send this exact amount from your own bank using the reference above, so it can be matched to this invoice. SEPA transfers typically take 1–2 business days.
                  </p>
                  <Button
                    type="button"
                    onClick={handleReportBankTransfer}
                    disabled={reporting}
                    variant="outline"
                    className="w-full h-11"
                  >
                    {reporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Landmark className="h-4 w-4 mr-2" />}
                    I've sent this transfer
                  </Button>
                </div>
              ) : (
                <Button onClick={handlePay} disabled={submitting} className="w-full h-12 text-base">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Pay {fmt(total, invoice.currency)}
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Powered by KrePay · Card, Apple Pay, Google Pay{sepa ? ", Bank transfer" : ""}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
