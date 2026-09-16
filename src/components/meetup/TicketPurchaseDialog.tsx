import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ticket, Tag, Check, X, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export const TicketPurchaseDialog = ({ open, onOpenChange, eventId, eventTitle, onSuccess }: Props) => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierId, setTierId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [promoCode, setPromoCode] = useState("");
  const [promoState, setPromoState] = useState<{ valid: boolean; discount: number; reason?: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(() => tiers.find(t => t.id === tierId), [tiers, tierId]);

  useEffect(() => {
    if (!open) return;
    setPromoCode("");
    setPromoState(null);
    setQuantity(1);
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_ticket_tiers")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_hidden", false)
        .order("display_order", { ascending: true });
      const list = (data || []) as Tier[];
      setTiers(list);
      if (list.length && !tierId) setTierId(list[0].id);
      setLoading(false);
    })();
  }, [open, eventId]);

  useEffect(() => {
    if (selected && quantity < selected.min_per_order) setQuantity(selected.min_per_order);
  }, [selected]);

  const subtotal = selected ? Number(selected.price) * quantity : 0;
  const discount = promoState?.valid ? promoState.discount : 0;
  const total = Math.max(0, subtotal - discount);
  const remaining = selected?.quantity_total != null ? selected.quantity_total - selected.quantity_sold : null;

  const validatePromo = async () => {
    if (!promoCode.trim() || !selected) return;
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-event-promo", {
        body: { eventId, tierId: selected.id, code: promoCode.trim(), quantity },
      });
      if (error) throw error;
      setPromoState(data);
      if (!data?.valid) toast.error(data?.reason || "Invalid promo code");
      else toast.success("Promo applied");
    } catch (e: any) {
      setPromoState({ valid: false, discount: 0, reason: e.message });
      toast.error("Could not validate promo");
    } finally {
      setValidating(false);
    }
  };

  const handleCheckout = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("checkout-event-tickets", {
        body: {
          eventId,
          tierId: selected.id,
          quantity,
          promoCode: promoState?.valid ? promoCode.trim() : undefined,
        },
      });
      if (error) throw error;
      if (data?.free && data?.redirectUrl) {
        toast.success("You're in! 🎟️");
        onSuccess?.();
        onOpenChange(false);
        window.location.href = data.redirectUrl;
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL");
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-lg">
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
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No ticket tiers available yet.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tier picker */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select tier</Label>
              <div className="space-y-2">
                {tiers.map(t => {
                  const isSel = t.id === tierId;
                  const left = t.quantity_total != null ? t.quantity_total - t.quantity_sold : null;
                  const soldOut = left != null && left <= 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => setTierId(t.id)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-all",
                        isSel
                          ? "border-energy bg-energy/5 ring-1 ring-energy"
                          : "border-border hover:border-foreground/30",
                        soldOut && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{t.name}</span>
                            {soldOut && <Badge variant="outline" className="text-[10px]">Sold out</Badge>}
                            {!soldOut && left != null && left <= 10 && (
                              <Badge className="bg-energy/20 text-energy text-[10px] uppercase">{left} left</Badge>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-lg">
                            {t.price > 0 ? `${t.currency} ${Number(t.price).toFixed(2)}` : "Free"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            {selected && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quantity</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(selected.min_per_order, quantity - 1))}
                    disabled={quantity <= selected.min_per_order}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="font-display text-2xl w-12 text-center">{quantity}</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(selected.max_per_order, remaining ?? 99, quantity + 1))}
                    disabled={quantity >= Math.min(selected.max_per_order, remaining ?? 99)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">
                    Max {Math.min(selected.max_per_order, remaining ?? selected.max_per_order)} per order
                  </span>
                </div>
              </div>
            )}

            {/* Promo code */}
            {selected && Number(selected.price) > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Promo code
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={promoCode}
                    onChange={e => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoState(null);
                    }}
                    placeholder="ENTER CODE"
                    className="uppercase tracking-wider"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={validatePromo}
                    disabled={!promoCode.trim() || validating}
                  >
                    {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {promoState && (
                  <div className={cn(
                    "text-xs flex items-center gap-1",
                    promoState.valid ? "text-energy" : "text-destructive"
                  )}>
                    {promoState.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {promoState.valid ? `Saved ${selected.currency} ${promoState.discount.toFixed(2)}` : promoState.reason}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {selected && (
              <div className="border-t border-border pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{selected.currency} {subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-energy">
                    <span>Discount</span>
                    <span>−{selected.currency} {discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-display text-xl pt-1">
                  <span>Total</span>
                  <span>{selected.currency} {total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleCheckout}
              disabled={!selected || submitting}
              className="w-full bg-energy text-energy-foreground hover:bg-energy/90 font-bold uppercase tracking-wider"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : total === 0 ? (
                "Claim free ticket"
              ) : (
                `Pay ${selected?.currency} ${total.toFixed(2)}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
