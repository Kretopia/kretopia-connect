import { useState, useEffect, useCallback, useRef } from 'react';
import { MatchProfileCard } from './MatchProfileCard';
import { useAuth } from '@/hooks/useAuth';
import { useSwipeProfiles, SwipeProfile } from '@/hooks/useSwipeProfiles';
import { useSwipeActions } from '@/hooks/useSwipeActions';
import { useExternalOffers } from '@/hooks/useExternalOffers';
import { nextDeckItem } from '@/lib/swipeDeck';
import type { PublicListing } from '@/components/external/PublishedExternalListings';
import { ExternalOfferCard } from './ExternalOfferCard';
import { MatchModal } from './MatchModal';
import { ProfilePreviewSheet } from './ProfilePreviewSheet';
import { MatchExplanationDialog } from '@/components/discover/MatchExplanationDialog';
import { buildMatchReasons } from '@/lib/matchReasons';
import { HingeStyleCard } from '@/components/discover/HingeStyleCard';
import { SwipeFiltersState, DEFAULT_SWIPE_FILTERS } from '@/components/circle/SwipeFilters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { MatchStateCard } from './MatchStateCard';

export interface SwipeFeatureProps {
  onMatch?: (profile: any) => void;
  filters?: SwipeFiltersState;
  onProfilesCountChange?: (count: number) => void;
  /**
   * Also show offers found outside Kretopia (gigs a curator approved against their source) between the people. Off by default:
   * the deck is people only unless a surface turns it on. MatchDeck always disables offers.
   */
  offers?: boolean;
  /** How the profile card is drawn (see HingeStyleCard). Default: unchanged. */
  cardVariant?: 'default' | 'shell';
}

/** What the member just answered, newest first, so Undo can take either kind back. */
type Answered = { type: 'profile'; profile: SwipeProfile } | { type: 'offer'; offer: PublicListing; since: number };

export function SwipeFeature({ onMatch, filters = DEFAULT_SWIPE_FILTERS, onProfilesCountChange, offers = false, cardVariant = 'default' }: SwipeFeatureProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const { profiles, loading, refreshing, error, fetchProfiles, removeProfile } = useSwipeProfiles(user?.id, filters);
  const { recordSwipe } = useSwipeActions(user?.id);
  const { offers: externalOffers, resolve: resolveOffer, restore: restoreOffer } = useExternalOffers(user?.id, offers);
  const [profilesSinceOffer, setProfilesSinceOffer] = useState(0);

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
  const [swipeHistory, setSwipeHistory] = useState<Answered[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Get current user's profile for the match modal + check completion
  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('avatar_url, full_name, bio').eq('user_id', user.id).single().then(({ data }) => {
        if (data) setCurrentUserProfile(data);
      });
    }
  }, [user?.id]);

  const handleLike = useCallback(async (profile: SwipeProfile, context: { type: string; label: string }) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const result = await recordSwipe(profile.user_id, 'right');
    savingRef.current = false;
    setSaving(false);
    if (!result.success) return;
    
    // Add to history for undo
    setSwipeHistory(prev => [{ type: 'profile' as const, profile }, ...prev].slice(0, 5));
    setProfilesSinceOffer(n => n + 1);

    // Remove from stack
    removeProfile(profile.user_id, 'right');

    // Record the swipe as a right swipe with context
    
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
    } else if (profile._deckTier === 'second') {
      // Their interest was sent earlier and nothing is sent twice: say so instead of repeating the first message.
      toast('Already on its way', {
        description: "You showed interest before. We'll tell you the moment they answer.",
        icon: <img src="/brand/kretopia-identity/mark/kretopia-mark-transparent.webp" alt="" className="h-5 w-5" />,
        duration: 4500,
      });
    } else {
      toast.success('Kretopia interest sent', {
        description: 'Pending for now — if they connect too, your new connection will appear in Connected.',
        icon: <img src="/brand/kretopia-identity/mark/kretopia-mark-transparent.webp" alt="" className="h-5 w-5" />,
        duration: 4500,
      });
    }
  }, [recordSwipe, removeProfile, onMatch]);

  const handlePass = useCallback(async (profile: SwipeProfile) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const result = await recordSwipe(profile.user_id, 'left');
    savingRef.current = false;
    setSaving(false);
    if (!result.success) return;

    setProfilesSinceOffer(n => n + 1);
    setSwipeHistory(prev => {
      const next = [{ type: 'profile' as const, profile }, ...prev].slice(0, 5);
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
  }, [recordSwipe, removeProfile, navigate]);

  /** Invite someone: the share sheet where there is one, otherwise the link on the clipboard. */
  const inviteCreative = useCallback(async () => {
    const url = `${window.location.origin}/auth?tab=signup`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join me on Kretopia', text: 'Real creatives, real Passports. Meet the people behind the work.', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied', { description: 'Send it to a creative you would love to meet.' });
    } catch {
      /* the share sheet was dismissed */
    }
  }, []);

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

  // An offer found outside Kretopia: "Interested" keeps it in view and sends nothing; the explicit "Open at source" is the only way out.
  // `since` is kept so Undo can put the counter back and the offer is the very next card again.
  const handleOfferInterested = useCallback(async (offer: PublicListing) => {
    setSwipeHistory(prev => [{ type: 'offer' as const, offer, since: profilesSinceOffer }, ...prev].slice(0, 5));
    setProfilesSinceOffer(0);
    await resolveOffer(offer, 'right');
    toast.success('Kept for you', {
      description: "Nothing was sent to anyone. Open it at the source when you're ready.",
      duration: 6000,
      action: offer.apply_url ? { label: 'Open', onClick: () => window.open(offer.apply_url as string, '_blank', 'noopener,noreferrer') } : undefined,
    });
  }, [resolveOffer, profilesSinceOffer]);

  const handleOfferPass = useCallback(async (offer: PublicListing) => {
    setSwipeHistory(prev => [{ type: 'offer' as const, offer, since: profilesSinceOffer }, ...prev].slice(0, 5));
    setProfilesSinceOffer(0);
    await resolveOffer(offer, 'left');
  }, [resolveOffer, profilesSinceOffer]);

  const handleUndo = useCallback(async () => {
    const last = swipeHistory[0];
    if (!last || !user?.id) return;

    if (last.type === 'offer') {
      await restoreOffer(last.offer);
      setProfilesSinceOffer(last.since);
      setSwipeHistory(prev => prev.slice(1));
      toast.success('Undo successful!');
      return;
    }

    await supabase
      .from('swipes')
      .delete()
      .eq('user_id', user.id)
      .eq('target_id', last.profile.user_id)
      .eq('target_type', 'profile');

    setSwipeHistory(prev => prev.slice(1));
    setProfilesSinceOffer(n => Math.max(0, n - 1));
    fetchProfiles(false, false, last.profile.user_id);
    toast.success('Undo successful!');
  }, [swipeHistory, user?.id, fetchProfiles, restoreOffer]);

  // Who is looking is not known yet: wait, instead of flashing the empty "All Caught Up" state at
  // a member whose session is still loading.
  if (authLoading) {
    return (
      <MatchStateCard title="Finding your people" description="Discovering real Kretopia profiles." busy />
    );
  }

  // A visitor with no account has no deck: it is built around the signed-in member (their swipes,
  // blocks, connections and interests). "You've seen everyone" would be untrue for someone who has
  // seen no one, so say what is needed and point at the grid, which works without an account.
  if (!user) {
    return (
      <MatchStateCard title="Sign in to get your deck" description="Your next creative connection starts here.">
        <Button onClick={() => navigate('/auth?next=/match')} variant="hero" className="min-h-12 gap-2">Sign in <ArrowRight className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => navigate('/match?tab=browse&view=grid')} className="min-h-12 gap-2">Browse the grid</Button>
      </MatchStateCard>
    );
  }

  if (error) {
    return (
      <MatchStateCard title="Let's reconnect" description="Profiles couldn't be refreshed. Your interests are safe.">
        <Button variant="hero" className="min-h-12" onClick={() => fetchProfiles()}>Try again</Button>
        <Button variant="outline" className="min-h-12" onClick={() => navigate('/match?tab=browse&view=grid')}>Browse the grid</Button>
      </MatchStateCard>
    );
  }

  // People stay the deck; an offer found outside Kretopia comes up between them (see lib/swipeDeck.ts).
  const current = nextDeckItem(profiles, externalOffers, profilesSinceOffer);

  if (loading) {
    return (
      <MatchStateCard title="Finding your people" description="Discovering real Kretopia profiles." busy />
    );
  }

  if (!current) {
    // A deck on its way (a scan, a top-up, the end of a round) is a wait, not an empty deck.
    if (refreshing) {
      return <MatchStateCard title="Lining up your next matches" description="Checking for new Passports and creators worth a second look." busy />;
    }
    // Nobody at all can be shown: everyone is yourself, already connected or off-limits. Say so, and give a way to change it.
    return (
      <MatchStateCard title="Everyone available is already in your circle" description="New creators join Kretopia every day. Bring someone you would love to meet.">
        <Button variant="hero" className="min-h-12" onClick={() => void inviteCreative()}>Invite a creative</Button>
      </MatchStateCard>
    );
  }
  const tier = current.type === 'profile' ? current.item._deckTier ?? 'fresh' : 'fresh';
  const freshCount = profiles.filter(p => (p._deckTier ?? 'fresh') === 'fresh').length;

  return (
    <div className="k-match-stage w-full space-y-2">
      {/* Counter + Undo */}
      <div className="mx-auto flex h-7 w-full max-w-[460px] items-center justify-between gap-2 px-2">
        <p className="text-xs text-muted-foreground">
          {tier === 'passed'
            ? "You've met everyone new. These are people you passed earlier."
            : tier === 'second'
              ? 'Interest already sent. Waiting for their answer.'
              : `${freshCount} creator${freshCount !== 1 ? 's' : ''} to discover`}
          {externalOffers.length > 0 && ` · ${externalOffers.length} offer${externalOffers.length !== 1 ? 's' : ''} found outside Kretopia`}
        </p>
        {swipeHistory.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleUndo} className="text-xs text-muted-foreground gap-1">
            <RotateCcw className="h-3 w-3" /> Undo
          </Button>
        )}
      </div>

      {/* One card at a time: a person (Hinge-style), or an offer found outside Kretopia */}
      {current.type === 'offer' ? (
        <ExternalOfferCard
          key={current.item.id}
          offer={current.item}
          onInterested={handleOfferInterested}
          onPass={handleOfferPass}
          variant={cardVariant}
        />
      ) : cardVariant === 'shell' ? (
        <MatchProfileCard key={current.item.user_id} profile={current.item} busy={saving} onLike={handleLike} onPass={handlePass} />
      ) : (
        <HingeStyleCard
          key={current.item.user_id}
          profile={current.item}
          variant={cardVariant}
          onLike={handleLike}
          onPass={handlePass}
          onViewProfile={handleViewProfile}
        />
      )}

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
            image: explanationProfile.avatar_url || '',
            matchReasons: buildMatchReasons({
              signals: explanationProfile._matchSignals,
              role: explanationProfile.role,
              location: explanationProfile.location,
              lastActiveAt: explanationProfile.updated_at,
              collabIntent: explanationProfile.collab_intent,
              likedYou: explanationProfile._likedYou,
              max: 6,
            }).map((r) => r.label),
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
