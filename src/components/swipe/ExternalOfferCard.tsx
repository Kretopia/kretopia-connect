import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { SwipeCard } from "@/components/ui/swipe-card";
import { ListingLabels } from "@/components/external/ListingLabels";
import { sourceLinkHref, sourceLinkRel } from "../../../supabase/functions/_shared/discovery/labels";
import type { PublicListing } from "@/components/external/PublishedExternalListings";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import { cn } from "@/lib/utils";

interface ExternalOfferCardProps {
  offer: PublicListing;
  /** "Interested": keep it in view. Sends nothing to anyone and applies for nothing. */
  onInterested: (offer: PublicListing) => void;
  onPass: (offer: PublicListing) => void;
}

/**
 * An offer found outside Kretopia, in the Match deck. Same card frame and gestures as a person, but it says what it is:
 * External, Unclaimed (or Claimed), where it came from and when it was last checked. There is nobody on Kretopia to message and no
 * match to make, so the right swipe is "Interested" and the only way to act on the offer is the explicit button that opens the
 * publisher's own page.
 */
export function ExternalOfferCard({ offer, onInterested, onPass }: ExternalOfferCardProps) {
  const { dragOffset, swipeDirection, isDragging, isAnimating, cardRef, handleDragStart, handleDragMove, handleDragEnd, animateSwipe } = useSwipeGestures({
    onSwipeLeft: () => onPass(offer),
    onSwipeRight: () => onInterested(offer),
    swipeThreshold: 120,
    dragThreshold: 60,
  });

  const handlePassClick = useCallback(async () => {
    if (await animateSwipe("left")) onPass(offer);
  }, [animateSwipe, onPass, offer]);

  const handleInterestedClick = useCallback(async () => {
    if (await animateSwipe("right")) onInterested(offer);
  }, [animateSwipe, onInterested, offer]);

  // Left = Pass, Right = Interested, as on a person's card; never while typing elsewhere on the page.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); handlePassClick(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); handleInterestedClick(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePassClick, handleInterestedClick]);

  const where = [offer.original_publisher, offer.location, offer.remote_scope === "remote" ? "Remote" : null].filter(Boolean).join(" · ");

  return (
    <SwipeCard
      ref={cardRef}
      dragOffset={dragOffset}
      isDragging={isDragging}
      swipeDirection={swipeDirection}
      showOverlay={false}
      onMouseDown={handleDragStart}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onTouchStart={handleDragStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
      className="w-full min-w-0 rounded-xl border-border bg-card"
    >
      <CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:p-6" data-testid="external-offer-card">
        <ListingLabels claimed={offer.claimed} lastCheckedAt={offer.last_checked_at} sourceName={offer.source_provider} />
        <div className="space-y-1">
          <h2 className="break-words text-2xl font-bold leading-tight text-foreground">{offer.title}</h2>
          {where && <p className="text-sm font-medium text-foreground">{where}</p>}
        </div>
        {offer.excerpt && <p className="line-clamp-5 text-sm leading-relaxed text-muted-foreground">{offer.excerpt}</p>}
        <p className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          Found outside Kretopia. Kretopia is not the publisher, does not verify it, and sends nothing: no message, no application.{" "}
          <Link to={`/listing/${offer.id}`} className="text-foreground underline">Details</Link>
        </p>

        <div className="mt-auto space-y-3 border-t border-border pt-4">
          <div className="flex min-h-6 items-center justify-between gap-2 text-xs" aria-live="polite" aria-atomic="true">
            <span className={cn("inline-flex items-center gap-1.5 transition-colors", swipeDirection === "left" ? "font-semibold text-destructive" : "text-muted-foreground")}>
              <ArrowLeft className="h-3.5 w-3.5" /> {swipeDirection === "left" ? "Release to pass" : "Swipe left · Pass"}
            </span>
            <span className={cn("inline-flex items-center gap-1.5 transition-colors", swipeDirection === "right" ? "font-semibold text-success" : "text-muted-foreground")}>
              {swipeDirection === "right" ? "Release to keep" : "Swipe right · Interested"} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full border-destructive/30 hover:border-destructive hover:bg-destructive/10"
              onClick={handlePassClick}
              disabled={isAnimating}
              aria-label={`Pass on ${offer.title}`}
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
            {offer.apply_url && (
              <Button asChild variant="outline" className="h-11 shrink-0 rounded-full">
                <a href={sourceLinkHref(offer.source_provider, offer.apply_url)} target="_blank" rel={sourceLinkRel(offer.source_provider)} aria-label={`Open ${offer.title} at the source`}>
                  Open at source <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            )}
            <Button size="lg" className="cta-solid h-12 min-w-0 flex-1 gap-2 rounded-full" onClick={handleInterestedClick} disabled={isAnimating}>
              <Bookmark className="h-5 w-5" aria-hidden /> Interested
            </Button>
          </div>
        </div>
      </CardContent>
    </SwipeCard>
  );
}
