import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import {
  CheckCircle,
  Download,
  Package,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  Lock,
  MessageCircle,
} from "lucide-react";

export default function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [downloadUrls, setDownloadUrls] = useState<string[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>('completed');
  const [listingType, setListingType] = useState<string>('digital');
  const [error, setError] = useState<string | null>(null);

  const productId = searchParams.get('product_id');
  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type') || 'digital';

  useEffect(() => {
    setListingType(type);
    if (productId && sessionId) {
      completePurchase();
    } else {
      setError("Missing purchase information");
      setLoading(false);
    }
  }, [productId, sessionId]);

  const completePurchase = async () => {
    try {
      setLoading(true);

      // Get auth session for authenticated call
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      if (!authToken) {
        throw new Error("Please log in to complete your purchase");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-product-purchase`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ sessionId, productId }),
        }
      );
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to complete purchase');

      if (data?.downloadUrls) {
        setDownloadUrls(data.downloadUrls);
      }
      if (data?.orderStatus) {
        setOrderStatus(data.orderStatus);
      }
      if (data?.listingType) {
        setListingType(data.listingType);
      }

      const { data: productData } = await supabase
        .from('digital_products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productData) {
        setProduct(productData);
      }

      toast({
        title: "Purchase Complete!",
        description: listingType === 'digital' ? "Your files are ready to download" : "Your order has been placed",
      });

    } catch (err: any) {
      console.error('Error completing purchase:', err);
      setError(err.message || "Failed to complete purchase");
      toast({
        title: "Error",
        description: "There was an issue completing your purchase. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Processing your purchase...</p>
            <p className="text-sm text-muted-foreground">Please wait a moment</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              If you were charged, please contact support with your session ID: {sessionId}
            </p>
            <Button onClick={() => navigate('/circle')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO title="Purchase Complete - Kretopia" />
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Purchase Complete!</CardTitle>
            <CardDescription>
              {listingType === 'digital' 
                ? "Thank you for your purchase. Your files are ready." 
                : listingType === 'physical'
                ? "Your order has been placed. The seller will arrange delivery."
                : "Your booking is confirmed. The seller will be in touch."}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Product Info */}
            {product && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  {product.preview_urls?.[0] && (
                    <img 
                      src={product.preview_urls[0]} 
                      alt={product.title}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="capitalize">{listingType}</Badge>
                      <span className="font-bold text-primary">${product.price}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Digital: Download Section */}
            {listingType === 'digital' && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Your Downloads
                </h4>
                
                {downloadUrls.length > 0 ? (
                  <div className="space-y-2">
                    {downloadUrls.map((url, index) => (
                      <Button 
                        key={index}
                        variant="outline" 
                        className="w-full justify-between"
                        onClick={() => window.open(url, '_blank')}
                      >
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Download File {downloadUrls.length > 1 ? index + 1 : ''}
                        </span>
                      </Button>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Download links expire in 7 days. Access them anytime from your purchases.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Download links will be available in your purchases.
                  </p>
                )}
              </div>
            )}

            {/* Physical/Service: Escrow Info */}
            {listingType !== 'digital' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Payment Protected</h4>
                    <p className="text-xs text-muted-foreground">
                      {listingType === 'physical'
                        ? "Your payment is held securely in escrow until you confirm receipt of the item. You have 14 days to confirm or open a dispute."
                        : "Your payment is held securely in escrow until the service is completed. You have 7 days to confirm or open a dispute."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    What happens next
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    {listingType === 'physical' ? (
                      <>
                        <li>The seller will be notified and arrange shipping/pickup</li>
                        <li>Message the seller to coordinate delivery details</li>
                        <li>When you receive the item, confirm delivery in your orders</li>
                        <li>Payment is released to the seller after confirmation</li>
                      </>
                    ) : (
                      <>
                        <li>The seller will be notified about your booking</li>
                        <li>Message the seller to schedule your session</li>
                        <li>After the service is delivered, confirm completion</li>
                        <li>Payment is released to the seller after confirmation</li>
                      </>
                    )}
                  </ol>
                </div>

                {product && (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => navigate(`/messages?to=${product.user_id}`)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message Seller
                  </Button>
                )}
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <Link to="/purchases" className="block">
                <Button variant="outline" className="w-full">
                  View All Purchases
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              
              <Link to="/market" className="block">
                <Button className="w-full">
                  Continue Shopping
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              A receipt has been sent to your email. For any issues, contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
