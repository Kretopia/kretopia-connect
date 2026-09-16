import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, Lock, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  walletBalance: number;
  connectAvailable: number;
  connectPending: number;
  connectActive: boolean;
  currency?: string;
}

/**
 * Bank-style balance summary: what you can spend now, what's still
 * clearing, and what you've committed to escrow — never a single
 * ambiguous "balance" number. Every figure here is a real value already
 * fetched by the parent (wallet, Stripe Connect balance) or queried below
 * (committed) from the user's own rows — nothing here is invented for
 * visual polish.
 */
export function FinancialSummaryPanel({ walletBalance, connectAvailable, connectPending, connectActive, currency = "usd" }: Props) {
  const { user } = useAuth();
  const [committed, setCommitted] = useState<number | null>(null);
  const [asOf, setAsOf] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    // Funds this user has authorized into escrow for a milestone they
    // created (i.e. as the paying client) that haven't been released yet.
    supabase
      .from("milestones")
      .select("amount")
      .eq("created_by", user.id)
      .eq("escrow_status", "authorized")
      .neq("status", "paid")
      .then(({ data }) => {
        const total = (data || []).reduce((s, m: any) => s + Number(m.amount || 0), 0);
        setCommitted(total);
      });
    setAsOf(new Date());
  }, [user?.id, connectAvailable, connectPending, walletBalance]);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 });

  const tiles: { label: string; value: number; icon: typeof Wallet; tone: string; hint: string }[] = [
    { label: "Wallet balance", value: walletBalance, icon: Wallet, tone: "text-primary-foreground", hint: "Ready to send or spend" },
  ];

  if (connectActive) {
    tiles.push(
      { label: "Available", value: connectAvailable, icon: DollarSign, tone: "text-green-500", hint: "Ready to pay out" },
      { label: "Pending", value: connectPending, icon: Clock, tone: "text-amber-500", hint: "Still clearing" },
    );
  }

  if (committed !== null && committed > 0) {
    tiles.push({ label: "Committed", value: committed, icon: Lock, tone: "text-blue-500", hint: "Held in escrow, not yet released" });
  }

  return (
    <div className="space-y-2">
      <div className={cn("grid gap-3 sm:gap-4", tiles.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {tiles.map((t, i) =>
          i === 0 ? (
            <Card key={t.label} className={cn("bg-gradient-to-br from-primary via-primary/90 to-accent border-0", tiles.length === 1 && "col-span-2 sm:col-span-1")}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs text-primary-foreground/80">{t.label}</p>
                  <t.icon className="h-3.5 w-3.5 text-primary-foreground/60" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-primary-foreground">{fmt(t.value)}</p>
                <p className="text-[10px] text-primary-foreground/60 mt-0.5">{t.hint}</p>
              </CardContent>
            </Card>
          ) : (
            <Card key={t.label}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                  <t.icon className={cn("h-3.5 w-3.5", t.tone)} />
                </div>
                <p className={cn("text-2xl sm:text-3xl font-bold", t.tone)}>{fmt(t.value)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t.hint}</p>
              </CardContent>
            </Card>
          )
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-right pr-1">
        {currency.toUpperCase()} · as of {asOf.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
