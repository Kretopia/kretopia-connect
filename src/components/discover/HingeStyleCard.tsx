import { useState, useEffect, useCallback } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { extractSkillsArray } from '@/lib/matchScoring';
import { buildMatchReasons, type MatchReasonKey } from '@/lib/matchReasons';
import { badgeLabel } from '@/lib/badgeLabel';
import { CardContent } from '@/components/ui/card';
import { SwipeCard } from '@/components/ui/swipe-card';
import { HoloCard } from '@/components/passport/HoloCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Heart, X, MapPin, Briefcase, Sparkles, Star, Clock, Puzzle,
  ChevronDown, Eye, Handshake, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { SwipeProfile } from '@/hooks/useSwipeProfiles';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';

interface HingeStyleCardProps {
  profile: SwipeProfile;
  onLike: (profile: SwipeProfile, context: { type: string; label: string }) => void;
  onPass: (profile: SwipeProfile) => void;
  onViewProfile: (profile: SwipeProfile) => void;
  onMessage?: (profile: SwipeProfile) => void;
}

interface CreditItem {
  id: string;
  project_name: string;
  role: string;
  project_type: string | null;
  verification_status: string | null;
  primary_media_url: string | null;
  thumbnail_url: string | null;
}

export function HingeStyleCard({ profile, onLike, onPass, onViewProfile, onMessage }: HingeStyleCardProps) {
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  const skills = Array.from(new Set(extractSkillsArray(profile.professional_skills))).slice(0, 8);

  // Fetch top credits for this profile
  useEffect(() => {
    let active = true;
    setCredits([]);
    setExpanded(false);
    const fetchCredits = async () => {
      const { data } = await supabase
        .from('credits')
        .select('id, project_name, role, project_type, verification_status, primary_media_url, thumbnail_url')
        .eq('user_id', profile.user_id)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4);
      if (active && data) setCredits(data);
    };
    fetchCredits();
    return () => { active = false; };
  }, [profile.user_id]);

  // Both gestures and controls finish their exit before advancing the deck.
  const { dragOffset, swipeDirection, isDragging, isAnimating, cardRef, handleDragStart, handleDragMove, handleDragEnd, animateSwipe } =
    useSwipeGestures({
      onSwipeLeft: () => onPass(profile),
      onSwipeRight: () => onLike(profile, { type: 'profile', label: 'their profile' }),
      swipeThreshold: 120,
      dragThreshold: 60,
    });

  const handlePassClick = useCallback(async () => {
    if (await animateSwipe('left')) onPass(profile);
  }, [animateSwipe, onPass, profile]);

  const handleConnectClick = useCallback(async () => {
    if (await animateSwipe('right')) onLike(profile, { type: 'profile', label: 'their profile' });
  }, [animateSwipe, onLike, profile]);

  // Keyboard nav for the top card: Left = Pass, Right = Connect, Enter =
  // View Passport. Skipped while focus is in a text field so it never
  // hijacks typing elsewhere on the page.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePassClick(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleConnectClick(); }
      else if (e.key === 'Enter') { e.preventDefault(); onViewProfile(profile); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePassClick, handleConnectClick, onViewProfile, profile]);

  // The same reasons the grid and the explanation dialog give (lib/matchReasons.ts): similar craft, a craft that
  // complements yours, skills you share or lack, city, recent activity, an earlier collaboration, interest in you.
  // Their stated openness to collaborating is left out here: the card already shows it as their intent below.
  const REASON_ICONS: Record<MatchReasonKey, typeof Briefcase> = {
    'interested-in-you': Heart,
    'past-collab': Handshake,
    'shared-craft': Briefcase,
    'complementary-craft': Puzzle,
    'shared-skills': Sparkles,
    'new-skills': Puzzle,
    'same-city': MapPin,
    'recent-activity': Clock,
    'open-to-collab': Handshake,
  };
  const commonGround = buildMatchReasons({
    signals: profile._matchSignals,
    role: profile.role,
    location: profile.location,
    lastActiveAt: profile.updated_at,
    likedYou: profile._likedYou,
    max: 5,
  })
    .filter((r) => r.key !== 'open-to-collab')
    .map((r) => ({ icon: REASON_ICONS[r.key], label: r.label }));

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
      <HoloCard glow={false} maxTilt={isDragging || isAnimating ? 0 : 3}>
      <div className="min-w-0 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted lg:aspect-[4/3]">
          {profile.cover_image_url || profile.avatar_url ? (
            <img
              src={profile.cover_image_url || profile.avatar_url || ''}
              alt={profile.full_name}
              className="h-full w-full object-cover pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl font-bold text-muted-foreground">{profile.full_name.split(" ").map(part => part[0]).slice(0, 2).join("")}</div>
          )}
          {profile.cover_image_url && profile.avatar_url && (
            <img src={profile.avatar_url} alt="" draggable={false} className="absolute bottom-3 left-3 h-14 w-14 rounded-full border-2 border-background object-cover pointer-events-none" />
          )}
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BrandLogo lockup size="sm" />
            {profile.verification_tier === 'industry' ? (
              <Badge variant="outline" className="gap-1 border-success/30 text-success"><Sparkles className="h-3 w-3" />Industry verified</Badge>
            ) : profile.badge ? <Badge variant="secondary">{badgeLabel(profile.badge)}</Badge> : null}
          </div>
          <h2 className="break-words text-2xl font-bold leading-tight text-foreground">{profile.full_name}</h2>
          <div className="flex items-start gap-2 text-sm font-medium text-foreground"><Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{profile.role || 'Creator'}</span></div>
          {profile.sub_roles?.length ? <p className="text-sm text-muted-foreground">{profile.sub_roles.join(' · ')}</p> : null}
          {profile.location && <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{profile.location}</span></div>}
          {(profile.credits_count || profile.awards_count) ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {!!profile.credits_count && <span><strong className="text-foreground">{profile.credits_count}</strong> credits</span>}
              {!!profile.awards_count && <span><strong className="text-foreground">{profile.awards_count}</strong> awards</span>}
            </div>
          ) : null}
        </div>
      </div>

      {/* Engageable Content Sections */}
      <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
        {/* Common ground — why this profile ranked where it did */}
        {commonGround.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Why you connect</p>
            <div className="flex flex-wrap gap-1.5">
            {commonGround.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-foreground text-[10px] font-medium"
              >
                <Icon className="h-2.5 w-2.5" /> {label}
              </span>
            ))}
            </div>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="relative group">
            <p className="mb-2 text-xs font-semibold text-foreground">About</p>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
              {profile.bio}
            </p>
            <Button variant="ghost"
              onClick={() => onLike(profile, { type: 'bio', label: 'their bio' })}
              className="absolute -right-1 -bottom-1 h-7 w-7 rounded-full bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
              title="Like their bio"
              aria-label="Like their bio"
            >
              <Heart className="h-3.5 w-3.5 text-primary" />
            </Button>
          </div>
        )}

        {/* Skills — each is likeable */}
        {skills.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill: string, i: number) => (
                <Button variant="ghost"
                  key={i}
                  onClick={() => onLike(profile, { type: 'skill', label: skill })}
                  className="group h-auto whitespace-normal inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {skill}
                  <Heart className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Top Credits — view profile instead of auto-liking */}
        {credits.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Selected work</p>
            <div className="space-y-1.5">
              {credits.slice(0, expanded ? 4 : 2).map((credit) => (
                <Button variant="ghost"
                  key={credit.id}
                  onClick={() => onViewProfile(profile)}
                  className="group h-auto w-full justify-start flex items-center gap-2.5 p-2 rounded-lg hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0">
                    {credit.thumbnail_url || credit.primary_media_url ? (
                      <img src={credit.thumbnail_url || credit.primary_media_url || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <Star className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{credit.project_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{credit.role}</p>
                  </div>
                  {credit.verification_status === 'verified' && (
                    <Badge variant="outline" className="text-[8px] h-4 shrink-0 border-success/30 text-success">✓</Badge>
                  )}
                  <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Button>
              ))}
              {credits.length > 2 && (
                <Button variant="ghost"
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline mx-auto"
                >
                  {expanded ? 'Show less' : `+${credits.length - 2} more`}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Collab Intent */}
        {profile.collab_intent && (
          <Button variant="ghost"
            onClick={() => onLike(profile, { type: 'intent', label: profile.collab_intent || '' })}
            className="group h-auto whitespace-normal w-full flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 hover:border-primary/30 transition-colors"
          >
            <span className="text-xs font-medium text-primary">
              {profile.collab_intent === 'looking_to_hire' ? 'Looking to hire' :
               profile.collab_intent === 'available_for_hire' ? 'Available for hire' :
               profile.collab_intent === 'open_to_trade' ? 'Open to trade' :
               profile.collab_intent === 'seeking_collaborators' ? 'Seeking collaborators' :
               'Open to networking'}
            </span>
            <Heart className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
        )}

        {/* Action Buttons — encourage connection */}
        <div className="mt-auto space-y-3 border-t border-border pt-4">
          <div className="flex min-h-6 items-center justify-between gap-2 text-xs" aria-live="polite" aria-atomic="true">
            <span className={cn("inline-flex items-center gap-1.5 transition-colors", swipeDirection === 'left' ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              <ArrowLeft className="h-3.5 w-3.5" /> {swipeDirection === 'left' ? 'Release to pass' : 'Swipe left · Pass'}
            </span>
            <span className={cn("inline-flex items-center gap-1.5 transition-colors", swipeDirection === 'right' ? 'font-semibold text-success' : 'text-muted-foreground')}>
              {swipeDirection === 'right' ? 'Release to connect' : 'Swipe right · Connect'} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full shrink-0 border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
            onClick={handlePassClick}
            disabled={isAnimating}
            aria-label={`Pass on ${profile.full_name}`}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full shrink-0"
            onClick={() => onViewProfile(profile)}
            aria-label={`View ${profile.full_name}'s full profile`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            className="cta-solid h-12 min-w-0 flex-1 rounded-full gap-2"
            onClick={handleConnectClick}
            disabled={isAnimating}
          >
            <Heart className="h-5 w-5" /> Connect
          </Button>
          </div>
          {swipeDirection === 'right' && <p className="text-center text-xs text-muted-foreground">A match happens when you both connect.</p>}
        </div>
      </CardContent>
      </div>
      </HoloCard>
    </SwipeCard>
  );
}
