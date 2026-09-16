import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Download, Package, Wrench, MapPin, Clock, MessageCircle,
  ShieldAlert, Share2, Flag, Heart, ChevronLeft, ChevronRight, ShoppingCart, Loader2, Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

const TYPE_CONFIG = {
  digital: { icon: Download, color: "bg-primary/10 text-primary", label: "Digital Product" },
  physical: { icon: Package, color: "bg-amber-500/10 text-amber-500", label: "Physical Item" },
  service: { icon: Wrench, color: "bg-emerald-500/10 text-emerald-500", label: "Service" },
};

const ListingDetail = () => {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [listing, setListing] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (listingId) fetchListing();
  }, [listingId]);

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from("digital_products")
        .select("*")
        .eq("id", listingId)
        .single();

      if (error) throw error;
      setListing(data);

      // Fetch seller profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role, bio, location")
        .eq("user_id", data.user_id)
        .single();

      setSeller(profile);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Listing not found", variant: "destructive" });
      navigate("/market");
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    navigate(`/messages?to=${listing.user_id}`);
  };

  const handleBuy = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-digital-product', {
        body: { productId: listing.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        // Use window.open for better compatibility in embedded/iframe contexts
        const opened = window.open(data.url, '_blank');
        if (!opened) {
          // Fallback if popup blocked
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast({ 
        title: "Purchase failed", 
        description: err.message || "Failed to initiate checkout", 
        variant: "destructive" 
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    const path = window.location.pathname;
    const url = `https://www.kretopia.com${path}`;
    try {
      await navigator.share({ title: listing.title, url });
    } catch {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Listing link copied to clipboard" });
    }
  };

  const images = listing?.preview_urls?.length > 0 ? listing.preview_urls : [];
  const typeConfig = listing ? (TYPE_CONFIG[listing.listing_type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.digital) : TYPE_CONFIG.digital;
  const TypeIcon = typeConfig.icon;
  const isOwner = user?.id === listing?.user_id;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title={listing.title} description={listing.description || "View listing on Kretopia Market"} />

      <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/market")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Market
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Images */}
          <div className="lg:col-span-3 space-y-4">
            {/* Main Image */}
            <div className="aspect-[4/3] bg-muted rounded-xl overflow-hidden relative">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImageIndex]}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex(i => (i - 1 + images.length) % images.length)}
                        className="btn-glass btn-glass-outline absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex(i => (i + 1) % images.length)}
                        className="btn-glass btn-glass-outline absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              idx === currentImageIndex ? "bg-primary scale-125" : "bg-background/60"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TypeIcon className="h-16 w-16 text-muted-foreground/20" />
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      idx === currentImageIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-lg">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {listing.description || "No description provided."}
              </p>

              {/* Physical details */}
              {listing.listing_type === "physical" && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <h3 className="font-medium text-sm">Item Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {listing.condition && (
                      <div>
                        <span className="text-muted-foreground">Condition:</span>{" "}
                        <span className="capitalize font-medium">{listing.condition.replace("_", " ")}</span>
                      </div>
                    )}
                    {listing.shipping_method && (
                      <div>
                        <span className="text-muted-foreground">Delivery:</span>{" "}
                        <span className="capitalize font-medium">{listing.shipping_method.replace("_", " ")}</span>
                      </div>
                    )}
                    {listing.item_location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>{listing.item_location}</span>
                      </div>
                    )}
                    {listing.shipping_price > 0 && (
                      <div>
                        <span className="text-muted-foreground">Shipping:</span>{" "}
                        <span className="font-medium">${listing.shipping_price}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Service details */}
              {listing.listing_type === "service" && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <h3 className="font-medium text-sm">Service Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {listing.service_duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{listing.service_duration}</span>
                      </div>
                    )}
                    {listing.service_format && (
                      <div>
                        <span className="text-muted-foreground">Format:</span>{" "}
                        <span className="capitalize font-medium">
                          {listing.service_format === "both" ? "Virtual or In Person" : listing.service_format.replace("_", " ")}
                        </span>
                      </div>
                    )}
                  </div>
                  {listing.availability_info && (
                    <div>
                      <span className="text-muted-foreground text-sm">Availability:</span>
                      <p className="text-sm mt-1">{listing.availability_info}</p>
                    </div>
                  )}
                </div>
              )}

              {listing.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {listing.tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right: Purchase / Contact Panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5 space-y-4 sticky top-20">
              {/* Type & Category */}
              <div className="flex items-center gap-2">
                <Badge className={`${typeConfig.color} border-0`}>
                  <TypeIcon className="h-3 w-3 mr-1" /> {typeConfig.label}
                </Badge>
                {listing.category && (
                  <Badge variant="outline" className="capitalize text-xs">{listing.category}</Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold">{listing.title}</h1>

              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">${listing.price}</span>
                {listing.listing_type === "service" && (
                  <span className="text-muted-foreground">/session</span>
                )}
                {listing.listing_type === "physical" && listing.shipping_price > 0 && (
                  <span className="text-sm text-muted-foreground">+ ${listing.shipping_price} shipping</span>
                )}
              </div>

              <Separator />

              {/* Seller Info */}
              {seller && (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/profile/${seller.user_id}`)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={seller.avatar_url} />
                    <AvatarFallback>{seller.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{seller.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{seller.role}</p>
                    {seller.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {seller.location}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isOwner && (
                <div className="space-y-2">
                  <Button 
                    className="w-full gap-2" 
                    size="lg" 
                    onClick={handleBuy}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-4 w-4" />
                    )}
                    {purchasing ? "Processing..." : `Buy Now — $${listing.price}`}
                  </Button>
                  
                  {listing.listing_type !== 'digital' && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <Lock className="h-3 w-3 text-primary shrink-0" />
                      <p className="text-[11px] text-muted-foreground">
                        Payment held in escrow until {listing.listing_type === 'physical' ? 'you confirm delivery' : 'service is completed'}
                      </p>
                    </div>
                  )}

                  <Button variant="outline" className="w-full gap-2" onClick={handleContact}>
                    <MessageCircle className="h-4 w-4" />
                    {listing.listing_type === "service" ? "Message Seller" : "Contact Seller"}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
                      <Share2 className="h-4 w-4" /> Share
                    </Button>
                    <Button variant="outline" size="icon">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {isOwner && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">This is your listing</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full">Remove Listing</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove your listing from the marketplace.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          const { error } = await supabase.from("digital_products").update({ is_active: false }).eq("id", listing.id).eq("user_id", user?.id);
                          if (error) {
                            console.error("Failed to remove listing:", error);
                            toast({ title: "Failed to remove listing", description: error.message, variant: "destructive" });
                            return;
                          }
                          toast({ title: "Listing removed" });
                          navigate("/market");
                        }}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              <Separator />

              {/* Disclaimer */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Marketplace Disclaimer</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Kretopia is a peer-to-peer marketplace. All transactions are between buyers and sellers directly. 
                      Kretopia does not verify listings, guarantee quality, or take responsibility for any transaction outcomes. 
                      Buyers should conduct their own due diligence before making any purchase. 
                      We strongly recommend communicating through the platform and verifying the seller's identity and reputation before proceeding.
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                      By using this marketplace, you agree that Kretopia and Thrive Collective are not liable for any disputes, 
                      damages, losses, or issues arising from marketplace transactions.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
