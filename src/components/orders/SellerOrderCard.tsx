import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OrderStatusBadge, DeliveryStatusBadge, ListingTypeBadge } from "./OrderStatusBadge";
import { Package, MessageCircle, Calendar, Clock, DollarSign, Truck, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  listing_type: string;
  amount: number;
  platform_fee: number | null;
  currency: string | null;
  status: string;
  delivery_status: string | null;
  tracking_number: string | null;
  auto_release_at: string | null;
  buyer_confirmed_at: string | null;
  shipped_at: string | null;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    preview_urls: string[] | null;
    product_type: string;
  } | null;
  buyer?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface SellerOrderCardProps {
  order: Order;
  onAction: () => void;
}

export function SellerOrderCard({ order, onAction }: SellerOrderCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");
  const [updating, setUpdating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleMarkShipped = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("marketplace_orders")
        .update({
          delivery_status: "shipped",
          shipped_at: new Date().toISOString(),
          tracking_number: trackingNumber || null,
        })
        .eq("id", order.id)
        .eq("seller_id", order.seller_id);

      if (error) throw error;
      toast({ title: "Marked as shipped ✓" });
      setDialogOpen(false);
      onAction();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkServiceComplete = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("marketplace_orders")
        .update({
          delivery_status: "completed",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("seller_id", order.seller_id);

      if (error) throw error;
      toast({ title: "Marked as complete ✓" });
      onAction();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const sellerAmount = order.amount - (order.platform_fee || 0);
  const needsFulfillment = order.status === "escrow" && order.delivery_status === "pending";
  const timeLeft = order.auto_release_at
    ? formatDistanceToNow(new Date(order.auto_release_at), { addSuffix: true })
    : null;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Image */}
        <div
          className="w-full sm:w-24 h-32 sm:h-24 rounded-lg overflow-hidden bg-muted cursor-pointer shrink-0"
          onClick={() => navigate(`/market/${order.listing_id}`)}
        >
          {order.listing?.preview_urls?.[0] ? (
            <img src={order.listing.preview_urls[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <Eye className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold truncate">{order.listing?.title || "Product"}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <ListingTypeBadge type={order.listing_type} />
                <OrderStatusBadge status={order.status} />
                {order.delivery_status && order.listing_type !== "digital" && (
                  <DeliveryStatusBadge status={order.delivery_status} />
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-4 w-4" />
                {sellerAmount.toFixed(2)}
              </div>
              {(order.platform_fee || 0) > 0 && (
                <p className="text-[11px] text-muted-foreground">Fee: ${(order.platform_fee || 0).toFixed(2)}</p>
              )}
            </div>
          </div>

          {/* Buyer info */}
          {order.buyer && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarImage src={order.buyer.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{order.buyer.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <span>from {order.buyer.full_name}</span>
            </div>
          )}

          {/* Time info */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(order.created_at).toLocaleDateString()}
            </span>
            {order.status === "escrow" && timeLeft && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Auto-releases {timeLeft}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2 shrink-0">
          {/* Physical: Mark shipped */}
          {needsFulfillment && order.listing_type === "physical" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  Ship
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark as shipped</DialogTitle>
                  <DialogDescription>
                    Add an optional tracking number for the buyer.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="Tracking number (optional)"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
                <DialogFooter>
                  <Button onClick={handleMarkShipped} disabled={updating}>
                    {updating ? "Updating..." : "Mark Shipped"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Service: Mark complete */}
          {needsFulfillment && order.listing_type === "service" && (
            <Button size="sm" className="gap-1" onClick={handleMarkServiceComplete} disabled={updating}>
              <Package className="h-3.5 w-3.5" />
              {updating ? "..." : "Complete"}
            </Button>
          )}

          {/* Message buyer */}
          <Button size="sm" variant="ghost" onClick={() => navigate(`/messages?to=${order.buyer_id}`)} className="gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            Message
          </Button>
        </div>
      </div>
    </Card>
  );
}
