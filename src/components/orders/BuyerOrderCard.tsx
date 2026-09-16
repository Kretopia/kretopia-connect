import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { OrderStatusBadge, DeliveryStatusBadge, ListingTypeBadge } from "./OrderStatusBadge";
import { Download, MessageCircle, CheckCircle, AlertTriangle, Calendar, Clock, Eye } from "lucide-react";
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
  currency: string | null;
  status: string;
  delivery_status: string | null;
  download_urls: string[] | null;
  auto_release_at: string | null;
  buyer_confirmed_at: string | null;
  tracking_number: string | null;
  delivery_notes: string | null;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    preview_urls: string[] | null;
    product_type: string;
  } | null;
  seller?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface BuyerOrderCardProps {
  order: Order;
  onAction: () => void;
}

export function BuyerOrderCard({ order, onAction }: BuyerOrderCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleConfirmDelivery = async () => {
    setConfirming(true);
    try {
      const { error } = await supabase.functions.invoke("release-escrow", {
        body: { orderId: order.id, action: "confirm" },
      });
      if (error) throw error;
      toast({ title: "Delivery confirmed ✓", description: "Payment released to seller" });
      onAction();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    setDisputing(true);
    try {
      const { error } = await supabase.functions.invoke("release-escrow", {
        body: { orderId: order.id, action: "dispute", reason: disputeReason },
      });
      if (error) throw error;
      toast({ title: "Dispute filed", description: "We'll review your case" });
      onAction();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDisputing(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-download-urls`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ orderId: order.id }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get download links');

      if (data.downloadUrls?.length) {
        data.downloadUrls.forEach((url: string) => window.open(url, '_blank'));
      } else {
        toast({ title: "No files available", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Download error", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const canConfirm = order.status === "escrow" && !order.buyer_confirmed_at;
  const canDispute = order.status === "escrow" && !order.buyer_confirmed_at;
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
              <div className="flex items-center gap-2 mt-1">
                <ListingTypeBadge type={order.listing_type} />
                <OrderStatusBadge status={order.status} />
                {order.delivery_status && order.listing_type !== "digital" && (
                  <DeliveryStatusBadge status={order.delivery_status} />
                )}
              </div>
            </div>
            <span className="text-lg font-bold text-primary">${order.amount.toFixed(2)}</span>
          </div>

          {/* Seller info */}
          {order.seller && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarImage src={order.seller.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{order.seller.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <span>from {order.seller.full_name}</span>
            </div>
          )}

          {/* Time info */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(order.created_at).toLocaleDateString()}
            </span>
            {canConfirm && timeLeft && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Auto-releases {timeLeft}
              </span>
            )}
          </div>

          {/* Tracking */}
          {order.tracking_number && (
            <p className="text-xs bg-muted px-2 py-1 rounded inline-block">
              Tracking: <span className="font-mono font-medium">{order.tracking_number}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2 shrink-0">
          {/* Digital downloads */}
          {order.listing_type === "digital" && order.download_urls?.length ? (
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading} className="gap-1">
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Loading..." : order.download_urls.length > 1 ? `Download (${order.download_urls.length} files)` : "Download"}
            </Button>
          ) : null}

          {/* Confirm delivery */}
          {canConfirm && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Confirm
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm {order.listing_type === "service" ? "completion" : "delivery"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will release ${order.amount.toFixed(2)} to the seller. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDelivery} disabled={confirming}>
                    {confirming ? "Releasing..." : "Yes, Release Payment"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Dispute */}
          {canDispute && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Dispute
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Open a dispute</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tell us what went wrong. We'll review and mediate.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Describe the issue..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="min-h-[80px]"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDispute}
                    disabled={disputing || !disputeReason.trim()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {disputing ? "Submitting..." : "Submit Dispute"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Message seller */}
          <Button size="sm" variant="ghost" onClick={() => navigate(`/messages?to=${order.seller_id}`)} className="gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            Message
          </Button>
        </div>
      </div>
    </Card>
  );
}
