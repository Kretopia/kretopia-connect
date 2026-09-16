import { useEffect, useState } from "react";
import { Wallet, Loader2, FileText, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MoneySectionProps {
  project: {
    id: string;
    client_price?: number | null;
    creative_payout?: number | null;
    currency?: string | null;
    deal_type?: string | null;
  };
  isOwner: boolean;
  /** Read-only client view: shows invoice + pay status, hides owner CTAs and cost basis */
  clientView?: boolean;
  onOpenInvoice: () => void;
}

interface InvoiceLite {
  id: string;
  status: string;
  total_amount: number | null;
}

const fmt = (n: number | null | undefined, ccy: string | null | undefined) => {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (ccy || "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${ccy || "$"} ${n.toLocaleString()}`;
  }
};

export const MoneySection = ({ project, isOwner, clientView = false, onOpenInvoice }: MoneySectionProps) => {
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("invoices")
          .select("id, status, total_amount")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setInvoice((data as unknown as InvoiceLite) ?? null);
      } catch (e) {
        console.error("[MoneySection] fetch invoice", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const value = project.client_price ?? project.creative_payout ?? null;
  const isPaid = invoice?.status === "paid";
  const isSent = invoice && !isPaid;

  const markPaid = async () => {
    if (!invoice) return;
    setMarking(true);
    const { error } = await supabase.rpc("confirm_invoice_paid_manually", {
      p_invoice_id: invoice.id,
      p_payment_method: "Marked paid manually",
    });
    setMarking(false);
    if (!error) setInvoice({ ...invoice, status: "paid" });
  };

  return (
    <section className="px-4 py-5 space-y-3">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
          Cashflow
        </p>
        <h2 className="text-lg font-black leading-none tracking-tight">
          The Money
        </h2>
      </header>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl ring-1 p-4 space-y-3 transition-all",
          isPaid
            ? "bg-gradient-to-br from-[hsl(var(--energy)/0.18)] via-[hsl(var(--energy)/0.06)] to-transparent ring-[hsl(var(--energy)/0.35)]"
            : "bg-gradient-to-br from-primary/12 via-primary/[0.04] to-transparent ring-border"
        )}
      >
        {/* Decorative glow */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl opacity-50",
            isPaid ? "bg-[hsl(var(--energy)/0.4)]" : "bg-primary/30"
          )}
        />

        <div className="relative flex items-start gap-3">
          <div
            className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1",
              isPaid
                ? "bg-[hsl(var(--energy)/0.2)] ring-[hsl(var(--energy)/0.4)] text-[hsl(var(--energy))]"
                : "bg-primary/15 ring-primary/30 text-primary"
            )}
          >
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {clientView ? "Amount due" : "Project value"}
            </p>
            <p className="text-3xl font-black leading-none tracking-tight mt-1">
              {clientView
                ? fmt(invoice?.total_amount ?? value, project.currency)
                : fmt(value, project.currency)}
            </p>
          </div>
        </div>

        {/* Status row */}
        <div className="relative grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-background/60 backdrop-blur-sm ring-1 ring-border/60 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Invoice
            </p>
            <p className="font-semibold flex items-center gap-1 mt-0.5">
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : invoice ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-primary" /> Sent
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 text-muted-foreground" /> Not sent
                </>
              )}
            </p>
          </div>
          <div className="rounded-lg bg-background/60 backdrop-blur-sm ring-1 ring-border/60 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Payment
            </p>
            <p
              className={cn(
                "font-semibold flex items-center gap-1 mt-0.5",
                isPaid && "text-[hsl(var(--energy))]"
              )}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isPaid ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Paid
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 text-muted-foreground" /> Pending
                </>
              )}
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        {isOwner && !clientView && (
          <div className="relative">
            {isPaid ? (
              <div className="w-full rounded-lg bg-[hsl(var(--energy)/0.18)] ring-1 ring-[hsl(var(--energy)/0.4)] py-2.5 flex items-center justify-center gap-2 text-[hsl(var(--energy))] font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" /> Paid in full
              </div>
            ) : isSent ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1.5" onClick={onOpenInvoice}>
                  <FileText className="h-4 w-4" /> View
                </Button>
                <Button
                  onClick={markPaid}
                  disabled={marking}
                  className="gap-1.5 bg-[hsl(var(--energy))] text-[hsl(var(--background))] hover:bg-[hsl(var(--energy)/0.9)] shadow-[0_0_12px_hsl(var(--energy)/0.4)]"
                >
                  {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Mark Paid
                </Button>
              </div>
            ) : (
              <Button onClick={onOpenInvoice} className="w-full gap-2">
                <FileText className="h-4 w-4" /> Send Invoice
              </Button>
            )}
          </div>
        )}

        {/* Client view CTA: pay or view invoice */}
        {clientView && (
          <div className="relative">
            {isPaid ? (
              <div className="w-full rounded-lg bg-[hsl(var(--energy)/0.18)] ring-1 ring-[hsl(var(--energy)/0.4)] py-2.5 flex items-center justify-center gap-2 text-[hsl(var(--energy))] font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" /> Paid — thank you
              </div>
            ) : invoice ? (
              <Button onClick={onOpenInvoice} className="w-full gap-2">
                <FileText className="h-4 w-4" /> View &amp; pay invoice
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center">
                No invoice yet — your collaborator will send one when ready.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
