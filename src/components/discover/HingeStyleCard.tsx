import { useState, useEffect, useCallback } from 'react';
import { badgeLabel } from '@/lib/badgeLabel';
import { CardContent } from '@/components/ui/card';
import { SwipeCard } from '@/components/ui/swipe-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Heart, X, MapPin, Briefcase, Sparkles, Star,
  ChevronDown, Eye, Handshake, Building2,
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

const formatProjectType = (t: string) =>
  t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function HingeStyleCard({ profile, onLike, onPass, onViewProfile, onMessage }: HingeStyleCardProps) {
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  const skills = (() => {
    if (!profile.professional_skills) return [];
    if (Array.isArray(profile.professional_skills)) {
      return profile.professional_skills.slice(0, 5).map((s: any) => typeof s === 'string' ? s : s.skill || s.name || '');
    }
    return [];
  })();

  // Fetch top credits for this profile
  useEffect(() => {
    const fetchCredits = async () => {
      const { data } = await supabase
        .from('credits')
        .select('id, project_name, role, project_type, verification_status, primary_media_url, thumbnail_url')
        .eq('user_id', profile.user_id)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4);
      if (data) setCredits(data);
    };
    fetchCredits();
  }, [profile.user_id]);

  const isIndustryVerified =
    (profile.credits_count || 0) >= 3 ||
    (profile.awards_count || 0) >= 2 ||
    profile.verification_tier === 'industry';

  // Real drag-to-swipe, same hook + presentational shell ForYouFeed
  // already uses -- a completed drag fires the parent action directly
  // (the drag motion itself is the confirmation); a button click has no
  // such motion, so it plays the equivalent slide-off animation first.
  const { dragOffset, swipeDirection, isDragging, cardRef, handleDragStart, handleDragMove, handleDragEnd, animateSwipe } =
    useSwipeGestures({
      onSwipeLeft: () => onPass(profile),
      onSwipeRight: () => onLike(profile, { type: 'profile', label: 'their profile' }),
      swipeThreshold: 120,
      dragThreshold: 60,
    });

  const handlePassClick = useCallback(async () => {
    await animateSwipe('left');
    onPass(profile);
  }, [animateSwipe, onPass, profile]);

  const handleConnectClick = useCallback(async () => {
    await animateSwipe('right');
    onLike(profile, { type: 'profile', label: 'their profile' });
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

  const projectTypes = Array.from(new Set(credits.map(c => c.project_type).filter(Boolean) as string[])).slice(0, 2);
  const projectsSummary = credits.length > 0
    ? `${credits.length} project${credits.length === 1 ? '' : 's'}${projectTypes.length > 0 ? ` · ${projectTypes.map(formatProjectType).join(' x ')}` : ''}`
    : null;

  const signals = profile._matchSignals;
  const commonGround = [
    signals?.sameSector && { icon: Briefcase, label: 'Same sector' },
    signals?.sameCity && { icon: MapPin, label: 'Same city' },
    signals?.pastCollab && { icon: Handshake, label: 'Worked together before' },
    !signals?.pastCollab && (signals?.skillOverlapRatio || 0) > 0.3 && { icon: Sparkles, label: 'Similar skills' },
  ].filter(Boolean) as { icon: typeof Briefcase; label: string }[];

  return (
    <SwipeCard
      ref={cardRef}
      dragOffset={dragOffset}
      isDragging={isDragging}
      swipeDirection={swipeDirection}
      onMouseDown={handleDragStart}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={handleDragStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
      className="w-full max-w-[360px] sm:max-w-sm mx-auto rounded-2xl border-border/50 bg-card"
    >
      {/* Hero Section — cover artwork leads, avatar is a small identity badge */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {profile.cover_image_url || profile.avatar_url ? (
          <img
            src={profile.cover_image_url || profile.avatar_url || ''}
            alt={profile.full_name}
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: "linear-gradient(150deg, hsl(var(--energy)/0.45), hsl(var(--primary)/0.35))" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {profile.cover_image_url && profile.avatar_url && (
          <div className="absolute top-3 right-3 h-11 w-11 rounded-full overflow-hidden ring-2 ring-white/70 shadow-lg">
            <img
              src={profile.avatar_url}
              alt=""
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {isIndustryVerified && (
            <Badge variant="outline" className="bg-accent/40 text-accent-foreground border-accent/60 backdrop-blur-sm text-[10px]">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Verified
            </Badge>
          )}
          {profile.badge && !isIndustryVerified && (
            <Badge variant="outline" className="backdrop-blur-sm border-white/30 text-[10px] text-white">
              {badgeLabel(profile.badge)}
            </Badge>
          )}
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-xl font-bold text-white drop-shadow-lg">{profile.full_name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Briefcase className="h-3.5 w-3.5 text-white/70" />
            <span className="text-white/90 text-sm">{profile.role || 'Creator'}</span>
          </div>
          {profile.location && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3 w-3 text-white/60" />
              <span className="text-white/70 text-xs">{profile.location}</span>
            </div>
          )}
          {projectsSummary && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-3 w-3 text-white/60" />
              <span className="text-white/70 text-xs">{projectsSummary}</span>
            </div>
          )}
        </div>

        {/* Like the photo itself */}
        <button
          onClick={() => onLike(profile, { type: 'photo', label: 'their photo' })}
          className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary/60 transition-colors group"
          title="Like their photo"
          aria-label="Like their photo"
        >
          <Heart className="h-5 w-5 text-white group-hover:fill-white transition-all" />
        </button>
      </div>

      {/* Engageable Content Sections */}
      <CardContent className="p-4 space-y-4">
        {/* Common ground — why this profile ranked where it did */}
        {commonGround.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {commonGround.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--energy)/0.1)] text-[hsl(var(--energy))] text-[10px] font-medium"
              >
                <Icon className="h-2.5 w-2.5" /> {label}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="relative group">
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {profile.bio}
            </p>
            <button
              onClick={() => onLike(profile, { type: 'bio', label: 'their bio' })}
              className="absolute -right-1 -bottom-1 h-7 w-7 rounded-full bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
              title="Like their bio"
              aria-label="Like their bio"
            >
              <Heart className="h-3.5 w-3.5 text-primary" />
            </button>
          </div>
        )}

        {/* Skills — each is likeable */}
        {skills.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill: string, i: number) => (
                <button
                  key={i}
                  onClick={() => onLike(profile, { type: 'skill', label: skill })}
                  className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {skill}
                  <Heart className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Top Credits — view profile instead of auto-liking */}
        {credits.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Verified Work</p>
            <div className="space-y-1.5">
              {credits.slice(0, expanded ? 4 : 2).map((credit) => (
                <button
                  key={credit.id}
                  onClick={() => onViewProfile(profile)}
                  className="group w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-primary/5 transition-colors text-left"
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
                    <Badge variant="outline" className="text-[8px] h-4 shrink-0 border-green-500/30 text-green-600">✓</Badge>
                  )}
                  <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
              {credits.length > 2 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline mx-auto"
                >
                  {expanded ? 'Show less' : `+${credits.length - 2} more`}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collab Intent */}
        {profile.collab_intent && (
          <button
            onClick={() => onLike(profile, { type: 'intent', label: profile.collab_intent || '' })}
            className="group w-full flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 hover:border-primary/30 transition-colors"
          >
            <span className="text-xs font-medium text-primary">
              {profile.collab_intent === 'looking_to_hire' ? '💼 Looking to Hire' :
               profile.collab_intent === 'available_for_hire' ? '🎯 Available for Hire' :
               profile.collab_intent === 'open_to_trade' ? '🤝 Open to Trade' :
               profile.collab_intent === 'seeking_collaborators' ? '🚀 Seeking Collaborators' :
               '👋 Just Networking'}
            </span>
            <Heart className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {/* Action Buttons — encourage connection */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full shrink-0 border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
            onClick={handlePassClick}
            aria-label={`Pass on ${profile.full_name}`}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full shrink-0"
            onClick={() => onViewProfile(profile)}
            aria-label={`View ${profile.full_name}'s full profile`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            className="h-12 flex-1 rounded-full bg-green-500 hover:bg-green-600 text-white gap-2"
            onClick={handleConnectClick}
          >
            <Heart className="h-5 w-5" /> Connect
          </Button>
        </div>
      </CardContent>
    </SwipeCard>
  );
}
