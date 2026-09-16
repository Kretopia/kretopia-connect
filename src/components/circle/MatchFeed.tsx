import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SwipeCard } from "@/components/ui/swipe-card";
import { MapPin, Star, X, Heart, Sparkles, User, Verified, Crown, Shield, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { maskCreatorName } from "@/lib/guestUtils";
import { ProfilePreviewDialog } from "./ProfilePreviewDialog";
import { MatchExplanationDialog } from "@/components/discover/MatchExplanationDialog";
import { CollabIntentBadge } from "@/components/profile/CollabIntentSelector";
import { useNavigate } from "react-router-dom";
import { EmptyMatchState } from "./EmptyMatchState";
import { SkeletonMatchCard } from "@/components/ui/skeleton-card";
import { cn } from "@/lib/utils";
import { TrustBadgeRow } from "@/components/profile/TrustSignals";
interface CreatorCard {
  id: string;
  user_id: string;
  name: string;
  title: string;
  location: string;
  image: string;
  description: string;
  badge?: string;
  level?: number;
  matchScore?: number;
  matchReasons?: string[];
  collab_intent?: string;
  verification_tier?: string;
  verification_status?: string;
  achievement_badges?: string[];
  subscription_tier?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  id_verified?: boolean;
  payment_verified?: boolean;
}

interface MatchFeedProps {
  cards: CreatorCard[];
  currentIndex: number;
  loading: boolean;
  dragOffset: { x: number; y: number };
  swipeDirection: "left" | "right" | null;
  isDragging: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onDragMove: (e: React.MouseEvent | React.TouchEvent) => void;
  onDragEnd: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
  isPro?: boolean;
}

const getBadgeColor = (badge: string) => {
  switch (badge) {
    case 'og': return 'bg-primary';
    case 'beta': return 'bg-primary';
    case 'vip': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
};

const getVerificationBadge = (tier: string | undefined, status: string | undefined) => {
  // Only show badge if status is 'verified'
  if (status !== 'verified' || !tier) return null;
  
  switch (tier) {
    case 'elite':
      return {
        icon: Crown,
        label: 'Elite',
        className: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0'
      };
    case 'industry':
      return {
        icon: Star,
        label: 'Industry',
        className: 'bg-gradient-to-r from-primary to-primary text-white border-0'
      };
    case 'verified':
      return {
        icon: Verified,
        label: 'Verified',
        className: 'bg-primary text-primary-foreground border-0'
      };
    default:
      return null;
  }
};

export const MatchFeed = ({
  cards,
  currentIndex,
  loading,
  dragOffset,
  swipeDirection,
  isDragging,
  onSwipeLeft,
  onSwipeRight,
  onDragStart,
  onDragMove,
  onDragEnd,
  cardRef,
  isPro = false
}: MatchFeedProps) => {
  const { user } = useAuth();
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [showMatchExplanation, setShowMatchExplanation] = useState(false);
  const [showProUpgrade, setShowProUpgrade] = useState(false);
  
  if (loading) {
    return (
      <div className="relative w-full max-w-sm mx-auto" style={{ height: '70vh', minHeight: '600px', maxHeight: '700px' }}>
        <div className="relative h-full overflow-hidden rounded-3xl">
          <SkeletonMatchCard />
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-8">
            <div className="space-y-3">
              <div className="h-8 w-40 bg-muted/50 rounded animate-pulse" />
              <div className="h-5 w-32 bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
          </div>
        </div>
        {/* Skeleton action buttons */}
        <div className="absolute -bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-8 z-20">
          <div className="h-20 w-20 rounded-full border-4 border-muted bg-card animate-pulse" />
          <div className="h-20 w-20 rounded-full border-4 border-muted bg-card animate-pulse" />
        </div>
      </div>
    );
  }

  const currentCard = currentIndex < cards.length ? cards[currentIndex] : null;
  const nextCard = currentIndex + 1 < cards.length ? cards[currentIndex + 1] : null;

  if (!currentCard) {
    return <EmptyMatchState onRefresh={() => window.location.reload()} />;
  }

  return (
    <div className="relative w-full max-w-sm mx-auto px-2 sm:px-0" style={{ height: 'calc(70vh - env(safe-area-inset-bottom, 0px))', minHeight: '500px', maxHeight: '650px' }}>
      {/* Tinder-Style Card Stack */}
      
      {/* Next Card Preview (Subtle) */}
      {nextCard && (
        <div className="absolute inset-0 -z-10 scale-[0.92] opacity-30 pointer-events-none">
          <div className="relative h-full overflow-hidden rounded-3xl shadow-2xl">
            {nextCard.image ? (
              <img
                src={nextCard.image}
                alt={nextCard.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 text-8xl">
                👤
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Card */}
      <SwipeCard
        ref={cardRef}
        dragOffset={dragOffset}
        swipeDirection={swipeDirection}
        isDragging={isDragging}
        onMouseDown={onDragStart}
        onMouseMove={onDragMove}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
        onTouchStart={onDragStart}
        onTouchMove={onDragMove}
        onTouchEnd={onDragEnd}
        className="absolute inset-0 rounded-3xl z-10"
      >
        <div className="relative h-full overflow-hidden rounded-3xl shadow-2xl">
          {/* Full Image Background */}
          <div className="absolute inset-0">
            {currentCard.image ? (
              <img
                src={currentCard.image}
                alt={currentCard.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 text-8xl">
                👤
              </div>
            )}
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          </div>
          
          {/* Top Badges */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
            <div className="flex flex-col gap-2">
              {/* Verification Badge - Primary */}
              {(() => {
                const verificationBadge = getVerificationBadge(currentCard.verification_tier, currentCard.verification_status);
                if (verificationBadge) {
                  const VerificationIcon = verificationBadge.icon;
                  return (
                    <Badge className={`${verificationBadge.className} font-bold shadow-2xl text-sm px-3 py-1`}>
                      <VerificationIcon className="h-3 w-3 mr-1" />
                      {verificationBadge.label}
                    </Badge>
                  );
                }
                return null;
              })()}
              {/* Collab Intent Badge */}
              {currentCard.collab_intent && (
                <CollabIntentBadge intent={currentCard.collab_intent} size="md" />
              )}
              {/* Pro Badge */}
              {(currentCard.subscription_tier === 'pro' || currentCard.subscription_tier === 'founder') && (
                <Badge className="bg-primary text-primary-foreground border-0 font-bold shadow-2xl text-sm px-3 py-1 gap-1">
                  <Crown className="h-3 w-3" />
                  PRO
                </Badge>
              )}
              {currentCard.badge && (
                <Badge 
                  className={`${getBadgeColor(currentCard.badge)} text-white font-bold shadow-2xl text-sm px-3 py-1`}
                >
                  {currentCard.badge.toUpperCase()}
                </Badge>
              )}
              {currentCard.level && currentCard.level > 1 && (
                <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 gap-1">
                  <Star className="h-3 w-3" />
                  Lv {currentCard.level}
                </Badge>
              )}
            </div>
            {currentCard.matchScore && (
              <Badge 
                className="bg-gradient-to-r from-primary to-primary text-white border-0 font-bold px-4 py-2 text-lg shadow-2xl cursor-pointer hover:scale-105 transition-transform relative"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPro) {
                    setShowMatchExplanation(true);
                  } else {
                    setShowProUpgrade(true);
                  }
                }}
              >
                {isPro ? <Sparkles className="h-3.5 w-3.5 mr-1 inline" /> : <Lock className="h-3.5 w-3.5 mr-1 inline" />} {currentCard.matchScore}%
              </Badge>
            )}
          </div>

          {/* Bottom Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 text-white z-10">
            <div className="space-y-3">
              <h3 className="text-3xl font-bold drop-shadow-lg flex items-center gap-2">
                {maskCreatorName(currentCard.name, !!user)}
                {currentCard.verification_status === 'verified' && (
                  <Verified className="h-6 w-6 text-primary" />
                )}
              </h3>
              <p className="text-lg font-medium text-white/90 drop-shadow-md">{currentCard.title}</p>
              
              {currentCard.location && (
                <div className="flex items-center gap-1 text-white/80">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-medium">{currentCard.location}</span>
               </div>
              )}

              {/* Trust Signals */}
              <TrustBadgeRow
                emailVerified={currentCard.email_verified}
                phoneVerified={currentCard.phone_verified}
                idVerified={currentCard.id_verified}
                paymentVerified={currentCard.payment_verified}
              />
              
              {currentCard.description && (
                <p className="text-sm text-white/80 line-clamp-2 mt-2 drop-shadow-md">
                  {currentCard.description}
                </p>
              )}

              {/* View Profile Button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewUserId(currentCard.user_id);
                }}
                className="mt-3 bg-white/20 hover:bg-white/30 backdrop-blur-md border-white/30 text-white"
              >
                <User className="h-4 w-4 mr-2" />
                View Profile
              </Button>
            </div>
          </div>
        </div>
      </SwipeCard>

      {/* Action Buttons - Mobile-optimized */}
      <div className="absolute -bottom-20 sm:-bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-6 sm:gap-8 z-20">
        <Button
          size="lg"
          variant="outline"
          onClick={onSwipeLeft}
          className={cn(
            "h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-destructive bg-card shadow-2xl",
            "hover:bg-destructive hover:scale-110 active:scale-95",
            "transition-all duration-200 group touch-manipulation"
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Pass"
        >
          <X className="h-8 w-8 sm:h-10 sm:w-10 text-destructive group-hover:text-destructive-foreground transition-colors" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onSwipeRight}
          className={cn(
            "h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-green-500 bg-card shadow-2xl",
            "hover:bg-green-500 hover:scale-110 active:scale-95",
            "transition-all duration-200 group touch-manipulation"
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Like"
        >
          <Heart className="h-8 w-8 sm:h-10 sm:w-10 text-green-500 group-hover:text-white fill-current transition-colors" />
        </Button>
      </div>

      {/* Profile Preview Dialog */}
      <ProfilePreviewDialog
        open={!!previewUserId}
        onOpenChange={(open) => !open && setPreviewUserId(null)}
        userId={previewUserId || ''}
        userName={currentCard.name}
      />

      {/* Match Explanation Dialog - Pro Only */}
      {isPro && (
        <MatchExplanationDialog
          open={showMatchExplanation}
          onOpenChange={setShowMatchExplanation}
          match={currentCard}
          onConnect={onSwipeRight}
          onPass={onSwipeLeft}
        />
      )}

      {/* Pro Upgrade Prompt for AI Match */}
      {showProUpgrade && (
        <ProMatchUpgradePrompt
          open={showProUpgrade}
          onOpenChange={setShowProUpgrade}
          matchScore={currentCard.matchScore}
          matchName={currentCard.name}
        />
      )}
    </div>
  );
};

// Pro Upgrade Prompt Component
function ProMatchUpgradePrompt({ 
  open, onOpenChange, matchScore, matchName 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  matchScore?: number; 
  matchName: string;
}) {
  const navigate = useNavigate();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Smart Match Insights
          </DialogTitle>
          <DialogDescription>
            Unlock detailed AI analysis for why you and {matchName} would work great together
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Blurred preview */}
          <div className="relative overflow-hidden rounded-lg">
            <div className="blur-md pointer-events-none p-4 bg-muted/50 space-y-3">
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-2xl font-bold">
                  {matchScore ?? 85}%
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-primary/20 rounded w-full" />
                <div className="h-4 bg-primary/20 rounded w-3/4" />
                <div className="h-4 bg-primary/20 rounded w-5/6" />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">Pro Feature</p>
              </div>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              See why AI thinks you're compatible
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              Get collaboration suggestions
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              Shared skills & complementary strengths
            </li>
          </ul>

          <Button 
            className="w-full" 
            onClick={() => {
              onOpenChange(false);
              navigate('/subscription');
            }}
          >
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Pro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
