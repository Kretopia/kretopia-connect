import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowDownToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currency: string;
  availableCents: number;
  defaultMethodLabel?: string;
  onPaidOut?: () => void;
}

export function WalletPayoutSheet({ open, onOpenChange, currency, availableCents, defaultMethodLabel, onPaidOut }: Props) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  // Stable across retries of the same submit attempt so Stripe's own
  // idempotency dedup can catch a double-click/retry; regenerated when the
  // sheet closes so the next cash-out gets a fresh key.
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!open) idempotencyKeyRef.current = crypto.randomUUID();
  }, [open]);

  const fmt = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(c / 100);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast({ title: "Enter an amount", variant: "destructive" });
    const cents = Math.round(n * 100);
    if (cents > availableCents) return toast({ title: "More than available", variant: "destructive" });

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-payout", {
        body: { amount_cents: cents, currency, method: "standard", idempotencyKey: idempotencyKeyRef.current },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Cash-out requested", description: "Funds usually arrive in 1–2 business days." });
      onPaidOut?.();
      onOpenChange(false);
      setAmount("");
    } catch (e: any) {
      toast({ title: "Couldn't cash out", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2"><ArrowDownToLine className="h-5 w-5" /> Cash out</SheetTitle>
          <SheetDescription>
            Available: <span className="font-semibold text-foreground">{fmt(availableCents)}</span>
            {defaultMethodLabel ? <> · to {defaultMethodLabel}</> : null}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Amount ({currency})</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAmount((availableCents / 100).toFixed(2))}>All</Button>
              <Button variant="outline" size="sm" onClick={() => setAmount((availableCents / 200).toFixed(2))}>Half</Button>
            </div>
          </div>
          <Button className="w-full" onClick={submit} disabled={loading || !amount}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending</> : `Cash out ${amount ? fmt(Math.round(Number(amount) * 100)) : ""}`}
          </Button>
          <p className="text-xs text-muted-foreground">Standard payouts arrive in 1–2 business days. Free.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
