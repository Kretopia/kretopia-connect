import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark, ArrowDownToLine, Plus, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WalletAddBankSheet } from "./WalletAddBankSheet";
import { WalletPayoutSheet } from "./WalletPayoutSheet";

type Balance = { currency: string; available_cents: number; pending_cents: number };
type Method = { id: string; type: string; last4: string | null; brand: string | null; currency: string; is_default: boolean };
type Wallet = { kyc_status: string; payouts_enabled: boolean; default_currency: string; country: string | null };
type Payout = { id: string; amount_cents: number; currency: string; status: string; arrival_date: string | null; created_at: string };

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export function ThriveWalletCard() {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("wallet-balance", { body: {} });
      const d = data as any;
      setWallet(d?.wallet ?? null);
      setBalances(d?.balances ?? []);
      setMethods(d?.methods ?? []);
      const { data: ph } = await supabase
        .from("creator_payouts")
        .select("id, amount_cents, currency, status, arrival_date, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      setPayouts((ph as Payout[]) ?? []);
    } catch (e) {
      console.error("[ThriveWalletCard]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const defaultMethod = methods.find((m) => m.is_default) ?? methods[0];
  const primaryBal = balances.find((b) => b.currency === (wallet?.default_currency ?? "USD")) ?? balances[0] ?? { currency: wallet?.default_currency ?? "USD", available_cents: 0, pending_cents: 0 };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>
    );
  }

  const needsBank = !defaultMethod;
  const verified = wallet?.payouts_enabled;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Available to cash out</p>
            <p className="text-4xl font-serif mt-1">{fmt(primaryBal.available_cents, primaryBal.currency)}</p>
            {primaryBal.pending_cents > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{fmt(primaryBal.pending_cents, primaryBal.currency)} pending</p>
            )}
          </div>
          {verified && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>}
        </div>

        <div className="flex gap-2">
          {needsBank ? (
            <Button onClick={() => setAddOpen(true)} className="flex-1">
              <Plus className="h-4 w-4 mr-2" /> Add your bank
            </Button>
          ) : (
            <>
              <Button onClick={() => setPayoutOpen(true)} className="flex-1" disabled={primaryBal.available_cents <= 0}>
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Cash out
              </Button>
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {balances.length > 1 && (
          <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap gap-3">
            {balances.filter((b) => b.currency !== primaryBal.currency).map((b) => (
              <div key={b.currency} className="text-xs">
                <span className="text-muted-foreground">{b.currency}</span>{" "}
                <span className="font-medium">{fmt(b.available_cents, b.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payout methods */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Payout methods</p>
        {methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payout method yet. Add a bank to get paid.</p>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-3">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{m.brand ?? "Bank"} ····{m.last4 ?? ""}</p>
                    <p className="text-xs text-muted-foreground">{m.currency} · {m.type === "card" ? "Card" : "Bank"}</p>
                  </div>
                </div>
                {m.is_default && <Badge variant="outline" className="text-xs">Default</Badge>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payout history */}
      {payouts.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Recent payouts</p>
          <div className="space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{fmt(p.amount_cents, p.currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.arrival_date && p.status !== "paid" ? ` · arrives ${new Date(p.arrival_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Badge variant={p.status === "paid" ? "secondary" : p.status === "failed" ? "destructive" : "outline"} className="text-xs">
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <WalletAddBankSheet open={addOpen} onOpenChange={setAddOpen} onAdded={load} />
      <WalletPayoutSheet
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        currency={primaryBal.currency}
        availableCents={primaryBal.available_cents}
        defaultMethodLabel={defaultMethod ? `${defaultMethod.brand ?? "Bank"} ····${defaultMethod.last4 ?? ""}` : undefined}
        onPaidOut={load}
      />
    </div>
  );
}
