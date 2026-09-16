import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Star, MapPin, DollarSign, Camera, Building2, Palette, Music, Navigation, Share2, Phone, Globe, ChevronLeft, ChevronRight, Loader2, Bookmark, BookmarkCheck, Headphones, ShoppingBag, ExternalLink, BadgeCheck, CalendarIcon, Clock } from "lucide-react";
import type { CreativeLocation } from "./LocationListItem";
import { ClaimLocationDialog } from "./ClaimLocationDialog";
import { LocationReviewHelpful } from "./LocationReviewHelpful";
import { LocationBookingDialog } from "./LocationBookingDialog";
import { ReviewPhotoUpload } from "./ReviewPhotoUpload";

interface LocationDetailDialogProps {
  location: CreativeLocation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

interface Review {
  id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  image_urls: string[];
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string; emoji: string }> = {
  studio: { icon: Music, color: 'text-primary', label: 'Studio', emoji: '🎙' },
  creative_space: { icon: Palette, color: 'text-emerald-500', label: 'Creative Space', emoji: '' },
  shoot_spot: { icon: Camera, color: 'text-rose-500', label: 'Shoot Spot', emoji: '' },
  venue: { icon: Building2, color: 'text-primary', label: 'Venue', emoji: '' },
  music_store: { icon: Headphones, color: 'text-primary', label: 'Music Store', emoji: '' },
  art_supply: { icon: ShoppingBag, color: 'text-orange-500', label: 'Art Supply', emoji: '' },
  rental_house: { icon: Building2, color: 'text-teal-500', label: 'Rental House', emoji: '' },
  photo_lab: { icon: Camera, color: 'text-pink-500', label: 'Photo Lab', emoji: '📷' },
};

export function LocationDetailDialog({ location, open, onOpenChange, isBookmarked, onToggleBookmark }: LocationDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);

  const config = location ? (TYPE_CONFIG[location.location_type] || TYPE_CONFIG.shoot_spot) : TYPE_CONFIG.shoot_spot;

  useEffect(() => {
    if (!location || !open) return;
    setActiveImageIndex(0);
    fetchReviews();
  }, [location?.id, open]);

  const fetchReviews = async () => {
    if (!location) return;
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from('location_reviews')
        .select('*')
        .eq('location_id', location.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((data || []).map(r => r.user_id))];
      let profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds);
        
        (profiles || []).forEach(p => {
          profileMap[p.user_id] = { full_name: p.full_name || 'Anonymous', avatar_url: p.avatar_url };
        });
      }

      const enrichedReviews: Review[] = (data || []).map(r => ({
        ...r,
        image_urls: r.image_urls || [],
        reviewer_name: profileMap[r.user_id]?.full_name || 'Anonymous',
        reviewer_avatar: profileMap[r.user_id]?.avatar_url || undefined,
      }));

      setReviews(enrichedReviews);
      
      const existing = enrichedReviews.find(r => r.user_id === user?.id);
      if (existing) {
        setHasReviewed(true);
        setUserRating(existing.rating);
        setReviewText(existing.review_text || '');
      } else {
        setHasReviewed(false);
        setUserRating(0);
        setReviewText('');
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !location || userRating === 0) return;
    setSubmitting(true);
    try {
      if (hasReviewed) {
        const { error } = await supabase
          .from('location_reviews')
          .update({ rating: userRating, review_text: reviewText.trim() || null })
          .eq('location_id', location.id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: "Review updated" });
      } else {
        const { error } = await supabase
          .from('location_reviews')
          .insert({
            location_id: location.id,
            user_id: user.id,
            rating: userRating,
            review_text: reviewText.trim() || null,
            image_urls: reviewPhotos.length > 0 ? reviewPhotos : null,
          });
        if (error) throw error;
        toast({ title: "Review submitted" });
      }
      setHasReviewed(true);
      setShowReviewForm(false);
      fetchReviews();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetDirections = () => {
    if (!location) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    if (!location) return;
    const text = `Check out ${location.name} on Kretopia Nearby!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: location.name, text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    }
  };

  if (!location) return null;

  const allImages = [
    ...(location.cover_image_url ? [location.cover_image_url] : []),
    ...(location.image_urls || []).filter(u => u !== location.cover_image_url),
  ];

  const nextImage = () => setActiveImageIndex(i => (i + 1) % allImages.length);
  const prevImage = () => setActiveImageIndex(i => (i - 1 + allImages.length) % allImages.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Hero Image Gallery */}
        {allImages.length > 0 ? (
          <div className="relative h-56 bg-muted group">
            <img 
              src={allImages[activeImageIndex]} 
              alt={location.name}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            
            {/* Navigation arrows */}
            {allImages.length > 1 && (
              <>
                <button 
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            
            {/* Dots */}
            {allImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${i === activeImageIndex ? 'bg-white w-5' : 'bg-white/50 w-1.5'}`}
                  />
                ))}
              </div>
            )}

            {/* Image count */}
            {allImages.length > 1 && (
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <Camera className="h-3 w-3" />
                {activeImageIndex + 1}/{allImages.length}
              </div>
            )}
            
            {/* Type badge */}
            <Badge className="absolute top-3 left-3 gap-1 bg-black/40 backdrop-blur-sm border-0 text-white" variant="secondary">
              {config.emoji} {config.label}
            </Badge>

            {/* Title overlay on image */}
            <div className="absolute bottom-3 left-3 right-3">
              <h2 className="text-lg font-bold text-white drop-shadow-md">{location.name}</h2>
              {location.address && (
                <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {location.address}{location.city ? `, ${location.city}` : ''}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="h-36 bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center gap-2 pt-6">
            <span className="text-5xl">{config.emoji}</span>
            <Badge variant="secondary" className="gap-1">{config.label}</Badge>
          </div>
        )}

        <div className="px-5 pb-5 space-y-4">
          {/* Title (when no images) & Rating row */}
          {allImages.length === 0 && (
            <div className="pt-3">
              <h2 className="text-xl font-bold">{location.name}</h2>
              {location.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" /> {location.address}{location.city ? `, ${location.city}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Rating + Distance row */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              {(location.average_rating ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.round(Number(location.average_rating)) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`} />
                  ))}
                  <span className="text-sm font-semibold ml-1">{Number(location.average_rating).toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({location.review_count})</span>
                </div>
              )}
            </div>
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location.distance_km < 1 
                ? `${Math.round(location.distance_km * 1000)}m away` 
                : `${location.distance_km.toFixed(1)}km away`
              }
            </span>
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            <Button size="sm" variant="default" className="flex-1 gap-1.5" onClick={handleGetDirections}>
              <Navigation className="h-3.5 w-3.5" />
              Directions
            </Button>
            {onToggleBookmark && (
              <Button size="sm" variant={isBookmarked ? "default" : "outline"} className="gap-1.5" onClick={onToggleBookmark}>
                {isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleShare}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            {location.contact_info && (
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <a href={`tel:${location.contact_info}`}>
                  <Phone className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {location.website_url && (
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <a href={location.website_url} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>

          {/* Brand profile link OR Claim button */}
          {location.claimed_by_user_id ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Verified Business</p>
                    <p className="text-xs text-muted-foreground">This spot is managed by a Kretopia business</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="text-xs gap-1" asChild>
                  <a href={`/profile/${location.claimed_by_user_id}`}>
                    <ExternalLink className="h-3 w-3" />
                    View Page
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : user && (
            <button
              onClick={() => setShowClaimDialog(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
            >
              <BadgeCheck className="h-4 w-4" />
              Own this spot? Claim it
            </button>
          )}

          {/* Description */}
          {location.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{location.description}</p>
          )}

          {/* Hours of Operation */}
          {(location as any).hours_of_operation && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Hours
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                  const hours = (location as any).hours_of_operation?.[day];
                  return (
                    <div key={day} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">{day}</span>
                      <span className={hours === 'Closed' ? 'text-destructive' : 'text-foreground font-medium'}>
                        {hours || 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {location.is_rentable && location.price_per_hour && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      ${location.price_per_hour} {location.price_currency || 'USD'}/hr
                    </p>
                    <p className="text-xs text-muted-foreground">Available for rent</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowBookingDialog(true)}>
                  <CalendarIcon className="h-3 w-3" />
                  Book Now
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Booking Dialog */}
          {location.is_rentable && location.price_per_hour && (
            <LocationBookingDialog
              location={location}
              open={showBookingDialog}
              onOpenChange={setShowBookingDialog}
            />
          )}

          {/* Amenities */}
          {(location.amenities?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Amenities</p>
              <div className="flex flex-wrap gap-1.5">
                {location.amenities!.map(a => (
                  <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {(location.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {location.tags!.map(t => (
                <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>
              ))}
            </div>
          )}

          {/* Pinned by */}
          {location.creator_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarImage src={location.creator_avatar || undefined} />
                <AvatarFallback className="text-[8px]">{location.creator_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              Pinned by {location.creator_name}
            </div>
          )}

          {/* Reviews Section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Reviews ({reviews.length})</h3>
              {user && !showReviewForm && (
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowReviewForm(true)}>
                  {hasReviewed ? 'Edit Review' : '+ Write Review'}
                </Button>
              )}
            </div>
            
            {/* Write a review (collapsible) */}
            {user && showReviewForm && (
              <Card className="mb-4 border-primary/20">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{hasReviewed ? 'Update your review' : 'Rate this spot'}</p>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setUserRating(s)}
                      >
                        <Star className={`h-7 w-7 transition-colors ${
                          s <= (hoverRating || userRating) 
                            ? 'fill-amber-500 text-amber-500' 
                            : 'text-muted-foreground/30 hover:text-amber-300'
                        }`} />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your experience..."
                    rows={2}
                    className="text-sm"
                  />
                  <ReviewPhotoUpload onPhotosUploaded={setReviewPhotos} existingPhotos={reviewPhotos} />
                  <Button 
                    size="sm" 
                    onClick={handleSubmitReview} 
                    disabled={submitting || userRating === 0}
                    className="w-full"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {hasReviewed ? 'Update Review' : 'Submit Review'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Reviews list */}
            {loadingReviews ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-6">
                <Star className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No reviews yet — be the first to rate this spot!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(review => (
                  <div key={review.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={review.reviewer_avatar} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {review.reviewer_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{review.reviewer_name}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`h-3 w-3 ${s <= review.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20'}`} />
                          ))}
                        </div>
                      </div>
                      {review.review_text && (
                        <p className="text-xs text-muted-foreground mt-0.5">{review.review_text}</p>
                      )}
                      {review.image_urls?.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5">
                          {review.image_urls.map((url, i) => (
                            <img key={i} src={url} alt="" className="h-14 w-14 rounded-md object-cover border border-border" />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-muted-foreground/60">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                        <LocationReviewHelpful reviewId={review.id} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Claim Dialog */}
        {location && (
          <ClaimLocationDialog
            open={showClaimDialog}
            onOpenChange={setShowClaimDialog}
            locationId={location.id}
            locationName={location.name}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
