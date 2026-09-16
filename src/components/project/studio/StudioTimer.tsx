import { useState } from "react";
import { Timer, Play, Square, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProjectTimer, formatHMS } from "@/hooks/useProjectTimer";
import { format } from "date-fns";

interface StudioTimerProps {
  projectId: string;
  userId?: string | null;
  /** Owner can also "Bill these hours" → draft invoice */
  isOwner?: boolean;
  onInvoiceDrafted?: () => void;
}

interface UnbilledTotals {
  hours: number;
  amount: number;
  count: number;
  currency: string;
}

export const StudioTimer = ({
  projectId,
  userId,
  isOwner,
  onInvoiceDrafted,
}: StudioTimerProps) => {
  const { running, elapsedSec, hourlyRate, currency, isRunning, start, stop } =
    useProjectTimer({ projectId, userId });

  const [billOpen, setBillOpen] = useState(false);
  const [totals, setTotals] = useState<UnbilledTotals | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [rateOverride, setRateOverride] = useState("");
  const [note, setNote] = useState("Hours worked");

  const fmtMoney = (n: number, c: string) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (c || "USD").toUpperCase(),
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${c || "$"} ${n.toFixed(2)}`;
    }
  };

  const openBill = async () => {
    if (!userId) return;
    setLoadingTotals(true);
    setBillOpen(true);
    setRateOverride(hourlyRate ? String(hourlyRate) : "");
    try {
      const { data, error } = await supabase
        .from("project_time_entries")
        .select("duration_seconds, hourly_rate, currency")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .is("billed_invoice_id", null)
        .not("ended_at", "is", null);
      if (error) throw error;
      let totalSec = 0;
      let amount = 0;
      let ccy = currency || "USD";
      (data || []).forEach((row: any) => {
        const sec = row.duration_seconds || 0;
        totalSec += sec;
        const rate = row.hourly_rate || hourlyRate || 0;
        amount += (sec / 3600) * rate;
        if (row.currency) ccy = row.currency;
      });
      setTotals({
        hours: totalSec / 3600,
        amount,
        count: data?.length || 0,
        currency: ccy,
      });
    } catch (e: any) {
      toast.error("Couldn't load hours", { description: e.message });
      setBillOpen(false);
    } finally {
      setLoadingTotals(false);
    }
  };

  const draftInvoice = async () => {
    if (!totals || !userId || totals.hours <= 0) return;
    setDrafting(true);
    try {
      const rate = parseFloat(rateOverride) || hourlyRate || 0;
      const amount = +(totals.hours * rate).toFixed(2);
      const invoiceNumber = `TIME-${Date.now().toString().slice(-8)}`;
      const lineItems = [
        {
          description: `${note} · ${totals.hours.toFixed(2)} hrs @ ${fmtMoney(rate, totals.currency)}/hr`,
          quantity: +totals.hours.toFixed(2),
          rate,
          amount,
        },
      ];
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          project_id: projectId,
          issued_by: userId,
          status: "draft",
          amount,
          currency: totals.currency,
          line_items: lineItems,
          notes: `${note} · auto-generated from tracked time on ${format(new Date(), "MMM d, yyyy")}`,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      // Mark entries as billed
      await supabase
        .from("project_time_entries")
        .update({ billed_invoice_id: (invoice as any).id })
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .is("billed_invoice_id", null)
        .not("ended_at", "is", null);
      toast.success("Draft invoice created", {
        description: `${fmtMoney(amount, totals.currency)} from ${totals.hours.toFixed(2)} hrs`,
      });
      setBillOpen(false);
      onInvoiceDrafted?.();
    } catch (e: any) {
      toast.error("Couldn't draft invoice", { description: e.message });
    } finally {
      setDrafting(false);
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 backdrop-blur-sm p-0.5">
        <Button
          type="button"
          size="sm"
          variant={isRunning ? "default" : "ghost"}
          onClick={() => (isRunning ? stop() : start())}
          className={cn(
            "h-7 gap-1.5 rounded-full px-2.5 text-xs font-bold",
            isRunning &&
              "bg-[hsl(var(--energy))] text-[hsl(var(--background))] hover:bg-[hsl(var(--energy)/0.9)] shadow-[0_0_10px_hsl(var(--energy)/0.5)]",
          )}
          aria-label={isRunning ? "Stop timer" : "Start timer"}
        >
          {isRunning ? (
            <>
              <Square className="h-3 w-3 fill-current" />
              <span className="tabular-nums">{formatHMS(elapsedSec)}</span>
            </>
          ) : (
            <>
              <Timer className="h-3.5 w-3.5" />
              <span>Track time</span>
            </>
          )}
        </Button>
        {isOwner && !isRunning && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full"
            onClick={openBill}
            aria-label="Bill tracked hours"
            title="Bill tracked hours"
          >
            <Receipt className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Sheet open={billOpen} onOpenChange={setBillOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[hsl(var(--energy))]" />
              Bill tracked hours
            </SheetTitle>
          </SheetHeader>

          {loadingTotals ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !totals || totals.count === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No unbilled hours on this project yet. Hit{" "}
              <Play className="h-3 w-3 inline -mt-0.5" /> Track time to start.
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="rounded-xl bg-muted/40 p-4 ring-1 ring-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Unbilled hours
                </p>
                <p className="text-3xl font-black tracking-tight">
                  {totals.hours.toFixed(2)}
                  <span className="text-sm text-muted-foreground font-bold ml-1">hrs</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Across {totals.count} session{totals.count === 1 ? "" : "s"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Hourly rate</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={rateOverride}
                    onChange={(e) => setRateOverride(e.target.value)}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input value={totals.currency} disabled className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Note for invoice</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="rounded-xl bg-[hsl(var(--energy)/0.08)] ring-1 ring-[hsl(var(--energy)/0.3)] p-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Invoice total</span>
                <span className="text-lg font-black text-[hsl(var(--energy))]">
                  {fmtMoney(
                    totals.hours * (parseFloat(rateOverride) || 0),
                    totals.currency,
                  )}
                </span>
              </div>

              <Button
                onClick={draftInvoice}
                disabled={drafting || totals.hours <= 0 || !parseFloat(rateOverride)}
                className="w-full gap-2"
              >
                {drafting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                Create draft invoice
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
