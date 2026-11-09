import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrencyAmount } from "@/lib/currency";

interface Tier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  quantity_total: number | null;
  quantity_sold: number;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  min_per_order: number;
  max_per_order: number;
  is_hidden: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  eventTitle: string;
  onSuccess?: () => void;
}

export const TicketPurchaseDialog = ({ open, onOpenChange, eventId, eventTitle }: Props) => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadTiers = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("event_ticket_tiers")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_hidden", false)
        .order("display_order", { ascending: true });
      if (error) throw error;
      setTiers((data || []) as Tier[]);
    } catch (error) {
      console.error("[TicketPurchaseDialog]", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!open) return;
    void loadTiers();
  }, [open, loadTiers]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight flex items-center gap-2">
            <Ticket className="h-5 w-5 text-energy" />
            Get Tickets
          </DialogTitle>
          <DialogDescription className="text-muted-foreground line-clamp-1">
            {eventTitle}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center">
            <KretopiaSpinner className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Ticket details couldn't be loaded.</p>
            <Button type="button" variant="outline" onClick={loadTiers}>Retry</Button>
          </div>
        ) : tiers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No ticket tiers available yet.
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div key={tier.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{tier.name}</p>
                    {tier.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tier.description}</p>}
                  </div>
                  <p className="shrink-0 text-right font-semibold">
                    {formatTierPrice(tier)}
                  </p>
                </div>
              </div>
            ))}
            <Alert>
              <AlertTitle>Reservations are unavailable</AlertTitle>
              <AlertDescription>
                Native ticket reservations are paused until atomic capacity checks and verified payment confirmation are available.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

function formatTierPrice(tier: Tier) {
  const price = Number(tier.price);
  if (!Number.isFinite(price) || price < 0) return "Price unavailable";
  if (price === 0) return "Free tier";
  return formatCurrencyAmount(price, tier.currency) ?? "Paid tier · currency unavailable";
}
