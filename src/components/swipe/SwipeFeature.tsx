import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSwipeProfiles, SwipeProfile } from '@/hooks/useSwipeProfiles';
import { useSwipeActions } from '@/hooks/useSwipeActions';
import { MatchModal } from './MatchModal';
import { ProfilePreviewSheet } from './ProfilePreviewSheet';
import { MatchExplanationDialog } from '@/components/discover/MatchExplanationDialog';
import { HingeStyleCard } from '@/components/discover/HingeStyleCard';
import { SwipeFiltersState, DEFAULT_SWIPE_FILTERS } from '@/components/circle/SwipeFilters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getDiscoveryMissingFields } from '@/lib/profileCompletion';
import { Button } from '@/components/ui/button';
import { EyeOff, Camera, FileText, Image as ImageIcon, ArrowRight, Heart, RotateCcw } from 'lucide-react';

interface SwipeFeatureProps {
  onMatch?: (profile: any) => void;
  filters?: SwipeFiltersState;
  onProfilesCountChange?: (count: number) => void;
}

export function SwipeFeature({ onMatch, filters = DEFAULT_SWIPE_FILTERS, onProfilesCountChange }: SwipeFeatureProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const { profiles, allProfilesCount, loading, error, fetchProfiles, removeProfile } = useSwipeProfiles(user?.id, filters);
  const { recordSwipe } = useSwipeActions(user?.id);

  // Notify parent of profiles count for filters display
  useEffect(() => {
    if (onProfilesCountChange) {
      onProfilesCountChange(profiles.length);
    }
  }, [profiles.length, onProfilesCountChange]);

  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showMatchExplanation, setShowMatchExplanation] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<SwipeProfile | null>(null);
  const [explanationProfile, setExplanationProfile] = useState<SwipeProfile | null>(null);
  const [matchedProfile, setMatchedProfile] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [swipeHistory, setSwipeHistory] = useState<SwipeProfile[]>([]);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Get current user's profile for the match modal + check completion
  useEffect(() => {
    if (user?.id) {
      Promise.all([
        supabase.from('profiles').select('avatar_url, full_name, bio').eq('user_id', user.id).single(),
        supabase.from('credits').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('credits').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]).then(([profileRes, portfolioRes, creditsRes]) => {
        if (profileRes.data) {
          setCurrentUserProfile(profileRes.data);
          const workCount = (portfolioRes.count || 0) + (creditsRes.count || 0);
          const missing = getDiscoveryMissingFields(profileRes.data as any, workCount);
          setProfileIncomplete(missing.length > 0);
          setMissingFields(missing);
        }
      });
    }
  }, [user?.id]);

  const handleLike = useCallback(async (profile: SwipeProfile, context: { type: string; label: string }) => {
    console.log('[SwipeFeature] Liked', profile.full_name, 'context:', context);
    
    // Add to history for undo
    setSwipeHistory(prev => [profile, ...prev].slice(0, 5));
    
    // Remove from stack
    removeProfile(profile.user_id);

    // Record the swipe as a right swipe with context
    const result = await recordSwipe(profile.user_id, 'right');
    
    if (result.isMatch && result.matchedProfile) {
      console.log('[SwipeFeature] MATCH!', result.matchedProfile);
      setMatchedProfile(result.matchedProfile);
      setShowMatchModal(true);
      
      if (onMatch) {
        onMatch({
          name: result.matchedProfile.full_name,
          avatar: result.matchedProfile.avatar_url,
          role: result.matchedProfile.role,
          userId: result.matchedProfile.user_id
        });
      }
    } else {
      toast.success(`Liked ${context.label}!`, { duration: 1500 });
    }
  }, [recordSwipe, removeProfile, onMatch]);

  const handlePass = useCallback(async (profile: SwipeProfile) => {
    console.log('[SwipeFeature] Passed', profile.full_name);

    setSwipeHistory(prev => {
      const next = [profile, ...prev].slice(0, 5);
      // After 3 swipes, nudge user toward the For You feed (once per session)
      try {
        const nudged = sessionStorage.getItem('foryou_nudged');
        if (!nudged && next.length >= 3) {
          sessionStorage.setItem('foryou_nudged', '1');
          toast("Check out your For You feed", {
            description: "Personalized creators, gigs and events waiting for you.",
            action: { label: 'Open', onClick: () => navigate('/') },
            duration: 6000,
          });
        }
      } catch {}
      return next;
    });
    removeProfile(profile.user_id);
    await recordSwipe(profile.user_id, 'left');
  }, [recordSwipe, removeProfile, navigate]);

  const handleViewProfile = useCallback((profile: SwipeProfile) => {
    setPreviewProfile(profile);
    setShowProfilePreview(true);
  }, []);

  const handlePreviewSwipe = useCallback((direction: 'left' | 'right') => {
    if (previewProfile) {
      if (direction === 'right') {
        handleLike(previewProfile, { type: 'profile', label: 'their profile' });
      } else {
        handlePass(previewProfile);
      }
      setPreviewProfile(null);
    }
  }, [previewProfile, handleLike, handlePass]);

  const handleUndo = useCallback(async () => {
    const lastProfile = swipeHistory[0];
    if (!lastProfile || !user?.id) return;

    await supabase
      .from('swipes')
      .delete()
      .eq('user_id', user.id)
      .eq('target_id', lastProfile.user_id)
      .eq('target_type', 'profile');

    setSwipeHistory(prev => prev.slice(1));
    fetchProfiles();
    toast.success('Undo successful!');
  }, [swipeHistory, user?.id, fetchProfiles]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error}</p>
        <button 
          onClick={() => fetchProfiles()}
          className="text-primary underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Block swiping for incomplete profiles
  if (profileIncomplete) {
    const fieldIcons: Record<string, React.ReactNode> = {
      'Profile Picture': <Camera className="h-4 w-4" />,
      'Bio (20+ characters)': <FileText className="h-4 w-4" />,
      'At least 1 Work Item (Portfolio or Credit)': <ImageIcon className="h-4 w-4" />,
    };

    return (
      <div className="w-full flex flex-col items-center justify-center py-12 px-4 text-center space-y-5">
        <div className="h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center">
          <EyeOff className="h-8 w-8 text-orange-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Complete Your Profile to Connect</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Other creators can't see you until your profile meets quality standards. Complete these items to unlock matching:
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {missingFields.map((field) => (
            <div key={field} className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/30 rounded-lg px-3 py-2.5 text-sm text-orange-800 dark:text-orange-200">
              {fieldIcons[field] || <EyeOff className="h-4 w-4" />}
              <span>{field}</span>
            </div>
          ))}
        </div>
        <Button onClick={() => navigate('/profile')} className="gap-2 mt-2">
          Complete Profile <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          You can still <button onClick={() => navigate('/circle?tab=browse')} className="text-primary underline">browse creators</button> while you complete your profile.
        </p>
      </div>
    );
  }

  const currentProfile = profiles[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
          <Heart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
        <p className="text-muted-foreground mb-1 max-w-sm">
          You've seen everyone available right now.
        </p>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          No matches yet? Explore the full Kretopia network in the grid, or complete your Passport so better matches keep finding you.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {swipeHistory.length > 0 && (
            <Button variant="outline" onClick={handleUndo} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Undo Last
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/match?tab=browse')} className="gap-2">
            <ArrowRight className="h-4 w-4" /> Browse the grid
          </Button>
          <Button onClick={() => navigate('/profile')} className="gap-2">
            Complete your Passport
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Counter + Undo */}
      <div className="flex items-center justify-between px-2">
        <p className="text-xs text-muted-foreground">
          {profiles.length} creator{profiles.length !== 1 ? 's' : ''} to discover
        </p>
        {swipeHistory.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleUndo} className="text-xs text-muted-foreground gap-1">
            <RotateCcw className="h-3 w-3" /> Undo
          </Button>
        )}
      </div>

      {/* Hinge-style card — one at a time */}
      <HingeStyleCard
        profile={currentProfile}
        onLike={handleLike}
        onPass={handlePass}
        onViewProfile={handleViewProfile}
      />

      <MatchModal
        open={showMatchModal}
        onOpenChange={setShowMatchModal}
        matchedProfile={matchedProfile}
        currentUserAvatar={currentUserProfile?.avatar_url}
      />

      {explanationProfile && (
        <MatchExplanationDialog
          open={showMatchExplanation}
          onOpenChange={setShowMatchExplanation}
          match={{
            user_id: explanationProfile.user_id,
            name: explanationProfile.full_name,
            title: explanationProfile.role,
            location: explanationProfile.location || '',
            image: explanationProfile.avatar_url || ''
          }}
          onConnect={() => handleLike(explanationProfile, { type: 'profile', label: 'their profile' })}
          onPass={() => handlePass(explanationProfile)}
        />
      )}

      <ProfilePreviewSheet
        profile={previewProfile}
        open={showProfilePreview}
        onOpenChange={setShowProfilePreview}
        onSwipe={handlePreviewSwipe}
      />
    </div>
  );
}
