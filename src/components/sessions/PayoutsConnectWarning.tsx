import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { WalletAddBankSheet } from "@/components/wallet/WalletAddBankSheet";

/**
 * Inline warning shown to event hosts when they enable paid ticketing
 * without a connected payout method. Opens the in-app "Add your bank"
 * sheet directly — no Stripe redirect.
 */
export const PayoutsConnectWarning = ({ visible }: { visible: boolean }) => {
  const [needsConnect, setNeedsConnect] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase
      .from("creator_wallets")
      .select("payouts_enabled")
      .eq("user_id", user.id)
      .maybeSingle() as unknown as Promise<{ data: { payouts_enabled: boolean } | null }>)
      .catch(() => ({ data: null }));
    setNeedsConnect(!data?.payouts_enabled);
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => { if (!cancelled) await refresh(); })();
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible || !needsConnect) return null;

  return (
    <>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="font-medium text-foreground">Add your bank to accept ticket sales</p>
          <p className="text-muted-foreground">
            Buyers can't check out until you have a payout method. Takes about a minute.
          </p>
          <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)} className="h-7 text-xs">
            Add your bank
          </Button>
        </div>
      </div>
      <WalletAddBankSheet open={sheetOpen} onOpenChange={setSheetOpen} onAdded={refresh} />
    </>
  );
};
