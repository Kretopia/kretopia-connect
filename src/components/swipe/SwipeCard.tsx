import { forwardRef } from 'react';
import { badgeLabel } from '@/lib/badgeLabel';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Briefcase, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReplySLABadge } from '@/components/passport/ReplySLABadge';
import { BookedThisMonthChip } from '@/components/passport/BookedThisMonthChip';

interface SwipeCardProps {
  profile: {
    user_id: string;
    full_name: string;
    role: string;
    bio: string | null;
    avatar_url: string | null;
    location: string | null;
    level: number;
    badge: string | null;
    collab_intent: string | null;
    portfolio_count?: number;
    is_claimed?: boolean;
    imported_from_url?: string | null;
    credits_count?: number;
    awards_count?: number;
    verification_tier?: string;
  };
  onViewProfile?: () => void;
  onMatchBadgeClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const COLLAB_INTENT_LABELS: Record<string, string> = {
  looking_to_hire: 'Looking to Hire',
  available_for_hire: 'Available for Hire',
  open_to_trade: 'Open to Trade',
  seeking_collaborators: 'Seeking Collaborators',
  just_networking: 'Just Networking'
};

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  ({ profile, onViewProfile, onMatchBadgeClick, style, className }, ref) => {
    const initials = profile.full_name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase() || '?';

    // Check if profile qualifies for Industry Verified badge
    const isIndustryVerified = 
      (profile.credits_count || 0) >= 3 || 
      (profile.awards_count || 0) >= 2 || 
      profile.verification_tier === 'industry';

    return (
      <Card
        ref={ref}
        className={cn(
          "absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing",
          "bg-card border border-border/30 shadow-2xl rounded-3xl",
          className
        )}
        style={style}
        onClick={onViewProfile}
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={profile.avatar_url || ''}
            alt={profile.full_name}
            className="w-full h-full object-cover"
          />
          {/* Enhanced Gradient Overlay - More cinematic */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 mix-blend-overlay" />
        </div>

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
          {/* Why you match Badge - Click to see why */}
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
            <Badge 
              variant="secondary" 
              className="bg-primary/90 text-primary-foreground px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold backdrop-blur-sm cursor-pointer hover:bg-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onMatchBadgeClick?.();
              }}
            >
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
              Smart Match
            </Badge>
          </div>

          {/* Industry Verified Badge - for profiles with 3+ credits OR 2+ awards */}
          {isIndustryVerified && (
            <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
              <Badge 
                variant="outline" 
                className="bg-gradient-to-r from-accent/40 to-accent/30 text-accent-foreground border-accent/60 backdrop-blur-sm text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Industry Verified
              </Badge>
            </div>
          )}

          {/* Unclaimed Badge - show for imported profiles (positioned after Industry Verified if both present) */}
          {profile.is_claimed === false && (
            <div className={cn(
              "absolute top-3 sm:top-4",
              isIndustryVerified ? "left-[9.5rem] sm:left-44" : "left-3 sm:left-4"
            )}>
              <Badge 
                variant="outline" 
                className="bg-primary/30 text-primary-foreground border-primary/50 backdrop-blur-sm text-xs"
              >
                Unclaimed
              </Badge>
            </div>
          )}

          {/* Badge (OG/Beta/ODOS) - only for claimed profiles without industry verified */}
          {!isIndustryVerified && profile.badge && (
            <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
              <Badge 
                variant="outline" 
                className={cn(
                  "backdrop-blur-sm border-white/30 text-xs",
                  profile.badge === 'og' && "bg-amber-500/20 text-amber-200 border-amber-400/50",
                  profile.badge === 'founding_member' && "bg-amber-500/25 text-amber-100 border-amber-300/60",
                  profile.badge === 'beta' && "bg-primary/20 text-primary border-primary/50",
                  profile.badge === 'odos' && "bg-green-500/20 text-green-200 border-green-400/50",
                  profile.badge === 'founder' && "bg-primary/20 text-primary border-primary/50"
                )}
              >
                {badgeLabel(profile.badge)}
              </Badge>
            </div>
          )}

          {/* Main Info */}
          <div className="space-y-2 sm:space-y-3">
            {/* Name & Role */}
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg line-clamp-1">
                {profile.full_name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/70 flex-shrink-0" />
                <span className="text-white/90 text-xs sm:text-sm md:text-base line-clamp-1">
                  {profile.role || 'Creator'}
                </span>
              </div>
            </div>

            {/* Location */}
            {profile.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/70 flex-shrink-0" />
                <span className="text-white/80 text-xs sm:text-sm line-clamp-1">{profile.location}</span>
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-white/80 text-xs sm:text-sm line-clamp-2 leading-relaxed">
                {profile.bio}
              </p>
            )}

            {/* Collab Intent + SLA badge */}
            <div className="flex flex-wrap items-center gap-2">
              {profile.collab_intent && (
                <span className="inline-flex px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-xs font-medium border border-white/10">
                  {COLLAB_INTENT_LABELS[profile.collab_intent] || profile.collab_intent}
                </span>
              )}
              <ReplySLABadge userId={profile.user_id} />
              <BookedThisMonthChip userId={profile.user_id} />
            </div>

            {/* Portfolio Count */}
            {profile.portfolio_count && profile.portfolio_count > 0 && (
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-400" />
                <span className="text-white/80 text-xs sm:text-sm">
                  {profile.portfolio_count} portfolio item{profile.portfolio_count !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Tap to View Profile Hint */}
            <p className="text-white/50 text-[10px] sm:text-xs pt-1 sm:pt-2">
              Tap to view full profile
            </p>
          </div>
        </div>
      </Card>
    );
  }
);

SwipeCard.displayName = 'SwipeCard';
