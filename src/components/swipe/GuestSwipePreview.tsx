import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SwipeCard } from './SwipeCard';
import { Button } from '@/components/ui/button';
import { X, Heart, Eye, UserPlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuestProfile {
  user_id: string;
  full_name: string;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  level: number;
  badge: string | null;
  collab_intent: string | null;
}

export function GuestSwipePreview() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<GuestProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const SWIPE_THRESHOLD = 100;
  const DRAG_THRESHOLD = 50;

  useEffect(() => {
    const fetchPreviewProfiles = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, full_name, role, bio, avatar_url, location, level, badge, collab_intent')
          .eq('is_claimed', true)
          .not('avatar_url', 'is', null)
          .not('bio', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6);
        setProfiles(data || []);
      } catch (err) {
        console.error('[GuestSwipePreview] Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreviewProfiles();
  }, []);

  const currentProfile = profiles[0];
  const nextProfile = profiles[1];

  const triggerAuthPrompt = useCallback(() => {
    setShowAuthPrompt(true);
  }, []);

  const handleSwipeAway = useCallback((direction: 'left' | 'right') => {
    if (isAnimating || !currentProfile) return;
    setIsAnimating(true);
    setSwipeDirection(direction);

    setTimeout(() => {
      // After first card, show auth prompt
      if (profiles.length <= 2) {
        triggerAuthPrompt();
      }
      setProfiles(prev => prev.slice(1));
      setSwipeDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setIsAnimating(false);
    }, 300);
  }, [isAnimating, currentProfile, profiles.length, triggerAuthPrompt]);

  // Drag handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (isAnimating) return;
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  }, [isAnimating]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isAnimating) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      setSwipeDirection(dx > 0 ? 'right' : 'left');
    } else {
      setSwipeDirection(null);
    }
  }, [isDragging, isAnimating]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragOffset.x) > SWIPE_THRESHOLD) {
      handleSwipeAway(dragOffset.x > 0 ? 'right' : 'left');
    } else {
      setDragOffset({ x: 0, y: 0 });
      setSwipeDirection(null);
    }
  }, [isDragging, dragOffset.x, handleSwipeAway]);

  const getCardStyle = (isTop: boolean): React.CSSProperties => {
    if (!isTop) return { transform: 'scale(0.95) translateY(10px)', opacity: 0.7, zIndex: 0 };
    const rotation = isDragging ? dragOffset.x * 0.1 : swipeDirection === 'left' ? -30 : swipeDirection === 'right' ? 30 : 0;
    const translateX = isDragging ? dragOffset.x : swipeDirection === 'left' ? -500 : swipeDirection === 'right' ? 500 : 0;
    return {
      transform: `translateX(${translateX}px) rotate(${rotation}deg)`,
      transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      zIndex: 10,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[420px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Auth prompt overlay
  if (showAuthPrompt || profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-[340px] sm:max-w-sm rounded-3xl overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 border border-border shadow-xl p-8 text-center space-y-5">
          <div className="h-16 w-16 rounded-full bg-primary/20 mx-auto flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold">Ready to Match?</h3>
          <p className="text-sm text-muted-foreground">
            Sign up to swipe, match, and collaborate with creators worldwide.
          </p>
          <Button
            onClick={() => navigate('/auth')}
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            size="lg"
          >
            <UserPlus className="h-4 w-4" />
            Sign Up to Match
          </Button>
          <button
            onClick={() => navigate('/auth')}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Already have an account? Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full px-4 sm:px-0">
      {/* Card Stack */}
      <div
        className="relative w-full max-w-[340px] sm:max-w-sm h-[420px] sm:h-[480px] md:h-[520px]"
        onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleDragEnd}
      >
        {nextProfile && (
          <SwipeCard
            profile={nextProfile}
            style={getCardStyle(false)}
            className="pointer-events-none"
          />
        )}

        {currentProfile && (
          <SwipeCard
            profile={currentProfile}
            style={getCardStyle(true)}
          />
        )}

        {/* Swipe Overlays */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-200 pointer-events-none z-20",
          swipeDirection === 'left' ? 'opacity-100' : 'opacity-0'
        )}>
          <div className="bg-red-500/90 rounded-full p-4 sm:p-6">
            <X className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
          </div>
        </div>
        <div className={cn(
          "absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-200 pointer-events-none z-20",
          swipeDirection === 'right' ? 'opacity-100' : 'opacity-0'
        )}>
          <div className="bg-green-500/90 rounded-full p-4 sm:p-6">
            <Heart className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 mt-4 sm:mt-6">
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-red-500/50 hover:bg-red-500/10 hover:border-red-500 active:scale-95 transition-transform"
          onClick={() => handleSwipeAway('left')}
          disabled={isAnimating}
        >
          <X className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border-2 active:scale-95 transition-transform"
          onClick={() => currentProfile && navigate(`/creator/${currentProfile.user_id}`)}
          disabled={isAnimating}
        >
          <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-green-500/50 hover:bg-green-500/10 hover:border-green-500 active:scale-95 transition-transform"
          onClick={() => handleSwipeAway('right')}
          disabled={isAnimating}
        >
          <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
        </Button>
      </div>

      {/* Sign up hint */}
      <p className="text-xs text-muted-foreground mt-3 text-center">
        <button onClick={() => navigate('/auth')} className="text-primary hover:underline font-medium">
          Sign up
        </button>
        {' '}to match & message creators
      </p>
    </div>
  );
}
