import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwipeCard } from './SwipeCard';
import { SwipeProfile } from '@/hooks/useSwipeProfiles';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FirstTimeHint } from '@/components/ui/first-time-hint';
import { useAccountTone } from '@/hooks/useAccountTone';
import { useTrinidadVoice } from '@/hooks/useTrinidadVoice';
import { X, Heart, RotateCcw, Eye, MessageCircle, Hand, Search, UserPlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeStackProps {
  profiles: SwipeProfile[];
  onSwipe: (profile: SwipeProfile, direction: 'left' | 'right') => void;
  onViewProfile: (profile: SwipeProfile) => void;
  onMatchBadgeClick: (profile: SwipeProfile) => void;
  onMessage?: (profile: SwipeProfile) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  loading?: boolean;
}

export function SwipeStack({
  profiles,
  onSwipe,
  onViewProfile,
  onMatchBadgeClick,
  onMessage,
  onUndo,
  canUndo = false,
  loading = false
}: SwipeStackProps) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Use first profile in the array as current (array shrinks as profiles are removed)
  const currentProfile = profiles[0];
  const nextProfile = profiles[1];
  const thirdProfile = profiles[2];

  

  const SWIPE_THRESHOLD = 100;
  const DRAG_THRESHOLD = 50;

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (isAnimating) return;
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  }, [isAnimating]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isAnimating) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    setDragOffset({ x: deltaX, y: deltaY * 0.3 });

    if (Math.abs(deltaX) > DRAG_THRESHOLD) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
    } else {
      setSwipeDirection(null);
    }
  }, [isDragging, isAnimating]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || isAnimating) return;
    setIsDragging(false);

    if (Math.abs(dragOffset.x) > SWIPE_THRESHOLD && currentProfile) {
      const direction = dragOffset.x > 0 ? 'right' : 'left';
      animateSwipe(direction);
    } else {
      resetPosition();
    }
  }, [isDragging, isAnimating, dragOffset.x, currentProfile]);

  const resetPosition = useCallback(() => {
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  }, []);

  const animateSwipe = useCallback((direction: 'left' | 'right') => {
    if (!currentProfile) return;

    setIsAnimating(true);
    setSwipeDirection(direction);

    const targetX = direction === 'right' ? window.innerWidth * 1.5 : -window.innerWidth * 1.5;
    setDragOffset({ x: targetX, y: 0 });

    setTimeout(() => {
      onSwipe(currentProfile, direction);
      // Profile is removed from array by parent, no need to track index
      resetPosition();
      setIsAnimating(false);
    }, 300);
  }, [currentProfile, onSwipe, resetPosition]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) handleDragEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Button actions
  const handlePass = () => {
    if (!isAnimating && currentProfile) {
      animateSwipe('left');
    }
  };

  const handleLike = () => {
    if (!isAnimating && currentProfile) {
      animateSwipe('right');
    }
  };

  const handleViewProfile = () => {
    if (currentProfile && !isDragging) {
      onViewProfile(currentProfile);
    }
  };

  const handleMessage = () => {
    if (currentProfile && onMessage) {
      onMessage(currentProfile);
    }
  };

  // Card transform styles
  const getCardStyle = (isActive: boolean, depth = 1): React.CSSProperties => {
    if (!isActive) {
      return {
        transform: `scale(${1 - depth * 0.04}) translateY(${depth * 14}px)`,
        opacity: depth === 1 ? 0.6 : 0.35,
        transition: 'all 0.3s ease',
        zIndex: 5 - depth,
      };
    }

    const rotation = (dragOffset.x / 20) * (isDragging ? 1 : 0);
    return {
      transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`,
      transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      zIndex: 10
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentProfile) {
    return <EmptyDeck canUndo={canUndo} onUndo={onUndo} />;
  }

  return (
    <div className="flex flex-col items-center w-full px-4 sm:px-0">
      <FirstTimeHint
        storageKey="match.tap-v2"
        title="Tap to connect or pass"
        description="Use the heart, X, or eye below the card. You can also drag the card if you prefer."
        icon={Hand}
        className="w-full max-w-[340px] sm:max-w-sm mb-3"
      />
      {/* Card Stack */}
      <div 
        className="relative w-full max-w-[340px] sm:max-w-sm h-[420px] sm:h-[480px] md:h-[520px]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Deck depth */}
        {thirdProfile && (
          <SwipeCard
            profile={thirdProfile}
            style={getCardStyle(false, 2)}
            className="pointer-events-none"
          />
        )}

        {/* Next Card (Preview) */}
        {nextProfile && (
          <SwipeCard
            profile={nextProfile}
            style={getCardStyle(false)}
            className="pointer-events-none"
          />
        )}

        {/* Current Card */}
        <SwipeCard
          ref={cardRef}
          profile={currentProfile}
          onViewProfile={handleViewProfile}
          onMatchBadgeClick={() => onMatchBadgeClick(currentProfile)}
          style={getCardStyle(true)}
        />

        {/* Swipe stamps — Tinder/Bumble style, opacity follows the drag */}
        <div
          className="absolute top-6 left-5 z-20 pointer-events-none -rotate-12 rounded-lg border-4 px-3 py-1 text-2xl font-black tracking-widest"
          style={{
            opacity: dragOffset.x < 0 ? Math.min(1, Math.abs(dragOffset.x) / SWIPE_THRESHOLD) : 0,
            borderColor: "hsl(var(--destructive))",
            color: "hsl(var(--destructive))",
          }}
        >
          NOPE
        </div>
        <div
          className="absolute top-6 right-5 z-20 pointer-events-none rotate-12 rounded-lg border-4 px-3 py-1 text-2xl font-black tracking-widest"
          style={{
            opacity: dragOffset.x > 0 ? Math.min(1, dragOffset.x / SWIPE_THRESHOLD) : 0,
            borderColor: "hsl(var(--signal-teal))",
            color: "hsl(var(--signal-teal))",
          }}
        >
          LIKE
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 mt-4 sm:mt-6">
        {/* Pass Button */}
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-red-500/50 hover:bg-red-500/10 hover:border-red-500 active:scale-95 transition-transform"
          onClick={handlePass}
          disabled={isAnimating}
        >
          <X className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
        </Button>

        {/* View Profile Button */}
        <Button
          variant="outline"
          size="lg"
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border-2 active:scale-95 transition-transform"
          onClick={handleViewProfile}
          disabled={isAnimating}
        >
          <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* Send Message Button */}
        {onMessage && (
          <Button
            variant="outline"
            size="lg"
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border-2 border-primary/50 hover:bg-primary/10 hover:border-primary active:scale-95 transition-transform"
            onClick={handleMessage}
            disabled={isAnimating}
          >
            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </Button>
        )}

        {/* Like Button */}
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-green-500/50 hover:bg-green-500/10 hover:border-green-500 active:scale-95 transition-transform"
          onClick={handleLike}
          disabled={isAnimating}
        >
          <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
        </Button>
      </div>

      {/* Undo Button */}
      {canUndo && onUndo && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 sm:mt-4 text-muted-foreground"
          onClick={onUndo}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Undo
        </Button>
      )}

      {/* Counter */}
      <p className="text-xs sm:text-sm text-muted-foreground mt-2">
        {profiles.length} creators available
      </p>
    </div>
  );
}

function EmptyDeck({ canUndo, onUndo }: { canUndo?: boolean; onUndo?: () => void }) {
  const navigate = useNavigate();
  const { isBusiness, pick } = useAccountTone();
  const { pick: pickVoice } = useTrinidadVoice();

  return (
    <div className="flex flex-col items-center justify-center min-h-[460px] w-full px-2">
      <EmptyState
        icon={Sparkles}
        eyebrow={pick(pickVoice("You're up to date", "Yuh all caught up"), "Roster reviewed")}
        title={pick(
          pickVoice("That's everyone for now", "Dat's everybody for now"),
          "No new talent right now",
        )}
        description={pick(
          pickVoice(
            "New creatives drop in daily. Browse the network or invite a collaborator to keep momentum.",
            "New creatives linkin' up daily. Browse the network or pull in a collab to keep the ting moving.",
          ),
          "Cast a wider net \u2014 search by skill or invite specific talent to apply.",
        )}
        accent="lime"
        action={{
          label: pick(pickVoice("Browse network", "Link up"), "Find talent"),
          icon: isBusiness ? Search : Eye,
          onClick: () => navigate(isBusiness ? "/talent-finder" : "/circle"),
        }}
        secondaryAction={{
          label: pick(pickVoice("Invite a collaborator", "Pull in a collab"), "Invite to apply"),
          icon: UserPlus,
          onClick: () => navigate("/invite"),
        }}
      />
      {canUndo && onUndo && (
        <Button variant="ghost" size="sm" onClick={onUndo} className="gap-2 mt-1 text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
          Undo last
        </Button>
      )}
    </div>
  );
}
