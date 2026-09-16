import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Download, ShoppingCart, ExternalLink, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProductReviewsList } from "./ProductReviewsList";
import { ProductReviewDialog } from "./ProductReviewDialog";
import { PurchaseProductDialog } from "./PurchaseProductDialog";

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
  average_rating?: number;
  review_count?: number;
  user_id: string;
}

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: DigitalProduct | null;
  sellerName?: string;
}

export const ProductDetailDialog = ({
  open,
  onOpenChange,
  product,
  sellerName
}: ProductDetailDialogProps) => {
  const { user } = useAuth();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [reviewRefresh, setReviewRefresh] = useState(0);

  useEffect(() => {
    if (open && product && user) {
      checkPurchaseStatus();
    }
  }, [open, product, user]);

  const checkPurchaseStatus = async () => {
    if (!product || !user) return;

    // Check if user has purchased
    const { data: purchase } = await supabase
      .from('product_purchases')
      .select('id')
      .eq('product_id', product.id)
      .eq('buyer_id', user.id)
      .eq('status', 'completed')
      .maybeSingle();

    setHasPurchased(!!purchase);
    setPurchaseId(purchase?.id || null);

    // Check if user has reviewed
    const { data: review } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('product_id', product.id)
      .eq('reviewer_id', user.id)
      .maybeSingle();

    setHasReviewed(!!review);
  };

  if (!product) return null;

  const isOwner = user?.id === product.user_id;
  const averageRating = product.average_rating || 0;
  const reviewCount = product.review_count || 0;

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {product.title}
              <Badge variant="secondary">{product.product_type}</Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1">
                Reviews ({reviewCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              {product.preview_urls?.[0] && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={product.preview_urls[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-primary">
                    ${product.price}
                  </span>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    {product.download_count} downloads
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {renderStars(Math.round(averageRating))}
                  <span className="text-sm text-muted-foreground">
                    ({averageRating.toFixed(1)})
                  </span>
                </div>
              </div>

              <p className="text-muted-foreground">{product.description}</p>

              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                {product.demo_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(product.demo_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Demo
                  </Button>
                )}
                
                {!isOwner && user && !hasPurchased && (
                  <Button onClick={() => setShowPurchaseDialog(true)} className="flex-1">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy Now - ${product.price}
                  </Button>
                )}

                {hasPurchased && !hasReviewed && (
                  <Button 
                    variant="secondary" 
                    onClick={() => setShowReviewDialog(true)}
                    className="flex-1"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Write a Review
                  </Button>
                )}

                {hasReviewed && (
                  <Badge variant="secondary" className="py-2 px-4">
                    ✓ You've reviewed this product
                  </Badge>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="mt-4">
              <ProductReviewsList 
                productId={product.id} 
                refreshTrigger={reviewRefresh}
              />
              
              {hasPurchased && !hasReviewed && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    You purchased this product. Share your experience!
                  </p>
                  <Button onClick={() => setShowReviewDialog(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Write a Review
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ProductReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        productId={product.id}
        productTitle={product.title}
        purchaseId={purchaseId || undefined}
        onSuccess={() => {
          setHasReviewed(true);
          setReviewRefresh(prev => prev + 1);
        }}
      />

      <PurchaseProductDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
        product={product}
        sellerName={sellerName}
      />
    </>
  );
};
