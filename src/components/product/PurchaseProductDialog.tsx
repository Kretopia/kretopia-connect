import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  CreditCard, 
  Download, 
  Shield, 
  Loader2,
  Package,
  Star,
  ExternalLink,
  AlertCircle
} from "lucide-react";

interface DigitalProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  product_type: string;
  category: string;
  preview_urls: string[];
  demo_url?: string;
  download_count: number;
  tags: string[];
  user_id: string;
}

interface PurchaseProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: DigitalProduct | null;
  sellerName?: string;
}

export const PurchaseProductDialog = ({ 
  open, 
  onOpenChange, 
  product,
  sellerName 
}: PurchaseProductDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handlePurchase = async () => {
    if (!product) return;
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to purchase this product",
        variant: "destructive",
      });
      return;
    }

    if (user.id === product.user_id) {
      toast({
        title: "Cannot purchase own product",
        description: "You cannot buy your own product",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('purchase-digital-product', {
        body: { productId: product.id }
      });

      if (error) throw error;

      if (data?.url) {
        const opened = window.open(data.url, '_blank');
        if (!opened) {
          window.location.href = data.url;
        }
      } else {
        throw new Error("No checkout URL received");
      }

    } catch (error: any) {
      console.error('Purchase error:', error);
      toast({
        title: "Purchase failed",
        description: error.message || "Unable to process purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Purchase Product
          </DialogTitle>
          <DialogDescription>
            Secure checkout powered by Stripe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Preview */}
          {product.preview_urls?.[0] && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <img 
                src={product.preview_urls[0]} 
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Product Info */}
          <div>
            <h3 className="font-semibold text-lg">{product.title}</h3>
            {sellerName && (
              <p className="text-sm text-muted-foreground">by {sellerName}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{product.product_type}</Badge>
              {product.category && (
                <Badge variant="outline">{product.category}</Badge>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-3">
            {product.description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              {product.download_count} downloads
            </span>
          </div>

          <Separator />

          {/* Price */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">
              ${product.price.toFixed(2)} {product.currency?.toUpperCase()}
            </span>
          </div>

          {/* Demo Link */}
          {product.demo_url && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open(product.demo_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview Demo
            </Button>
          )}

          {/* Security Note */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Secure payment via Stripe. Funds go directly to the creator.
              You'll receive instant access after purchase.
            </AlertDescription>
          </Alert>

          {/* Purchase Button */}
          <Button 
            onClick={handlePurchase} 
            disabled={loading || !user}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay ${product.price.toFixed(2)}
              </>
            )}
          </Button>

          {!user && (
            <p className="text-xs text-center text-muted-foreground">
              Please sign in to purchase this product
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
