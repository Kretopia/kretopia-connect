import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { badgeLabel } from '@/lib/badgeLabel';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SwipeProfile } from '@/hooks/useSwipeProfiles';
import { MapPin, Briefcase, Star, Sparkles, ExternalLink, X, Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { UserActionMenu } from '@/components/user/UserActionMenu';

interface ProfilePreviewSheetProps {
  profile: SwipeProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwipe: (direction: 'left' | 'right') => void;
  onMessage?: (profile: SwipeProfile) => void;
  matchReasons?: string[];
  matchScore?: number;
}

const COLLAB_INTENT_LABELS: Record<string, string> = {
  looking_to_hire: 'Looking to Hire',
  available_for_hire: 'Available for Hire',
  open_to_trade: 'Open to Trade',
  seeking_collaborators: 'Seeking Collaborators',
  just_networking: 'Just Networking'
};

export function ProfilePreviewSheet({
  profile,
  open,
  onOpenChange,
  onSwipe,
  onMessage,
  matchReasons = [],
  matchScore
}: ProfilePreviewSheetProps) {
  const navigate = useNavigate();

  if (!profile) return null;

  const initials = profile.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?';

  const extractSkills = (skills: any): string[] => {
    if (!skills) return [];
    if (Array.isArray(skills)) {
      return skills.map(s => {
        if (typeof s === 'string') return s;
        if (typeof s === 'object' && s !== null) {
          return s.skill || s.name || '';
        }
        return '';
      }).filter(Boolean).slice(0, 6);
    }
    if (typeof skills === 'object') {
      return Object.keys(skills).slice(0, 6);
    }
    return [];
  };

  const allSkills = [
    ...extractSkills(profile.professional_skills),
    ...extractSkills(profile.passion_skills)
  ].slice(0, 8);

  const handleViewFullProfile = () => {
    onOpenChange(false);
    navigate(`/profile/${profile.user_id}`);
  };

  const handlePass = () => {
    onOpenChange(false);
    onSwipe('left');
  };

  const handleLike = () => {
    onOpenChange(false);
    onSwipe('right');
  };

  const handleMessage = () => {
    if (onMessage && profile) {
      onOpenChange(false);
      onMessage(profile);
    } else {
      // Fallback: navigate to messages with user
      onOpenChange(false);
      navigate(`/messages?user=${profile.user_id}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <ScrollArea className="h-full">
          {/* Hero Image */}
          <div className="relative h-64 md:h-80">
            <img
              src={profile.avatar_url || ''}
              alt={profile.full_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            
            {/* Match Score */}
            {matchScore && (
              <div className="absolute top-4 right-4">
                <Badge className="bg-primary text-primary-foreground px-3 py-1.5">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {matchScore}% Match
                </Badge>
              </div>
            )}
          </div>

          <div className="px-6 pb-32 -mt-12 relative z-10">
            {/* Basic Info */}
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{profile.full_name}</h2>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <Briefcase className="h-4 w-4" />
                    <span>{profile.role || 'Creator'}</span>
                  </div>
                </div>
                
                {profile.badge && (
                  <Badge 
                    variant="outline"
                    className={cn(
                      profile.badge === 'og' && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                      profile.badge === 'founding_member' && "bg-amber-500/15 text-amber-700 border-amber-500/40",
                      profile.badge === 'beta' && "bg-primary/10 text-primary border-primary/30"
                    )}
                  >
                    {badgeLabel(profile.badge)}
                  </Badge>
                )}

                <UserActionMenu
                  targetUserId={profile.user_id}
                  targetUserName={profile.full_name || 'User'}
                  onBlocked={() => {
                    onOpenChange(false);
                    onSwipe('left');
                  }}
                />
              </div>

              {profile.location && (
                <div className="flex items-center gap-2 text-muted-foreground mt-2">
                  <MapPin className="h-4 w-4" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>

            {/* Collab Intent */}
            {profile.collab_intent && (
              <div className="mb-6">
                <Badge variant="secondary" className="text-sm">
                  {COLLAB_INTENT_LABELS[profile.collab_intent] || profile.collab_intent}
                </Badge>
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Why you match */}
            {matchReasons.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Why You're a Great Match
                </h3>
                <ul className="space-y-2">
                  {matchReasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-muted-foreground">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills */}
            {allSkills.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {allSkills.map((skill, i) => (
                    <Badge key={i} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Count */}
            {profile.portfolio_count && profile.portfolio_count > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>{profile.portfolio_count} portfolio items</span>
                </div>
              </div>
            )}

            {/* View Full Profile Button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleViewFullProfile}
            >
              <ExternalLink className="h-4 w-4" />
              View Full Profile
            </Button>
          </div>
        </ScrollArea>

        {/* Fixed Action Buttons at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-14 w-14 rounded-full border-2 border-red-500/50 hover:bg-red-500/10"
              onClick={handlePass}
            >
              <X className="h-6 w-6 text-red-500" />
            </Button>
            
            <Button
              size="lg"
              className="h-14 flex-1 max-w-[200px] rounded-full bg-green-500 hover:bg-green-600 gap-2"
              onClick={handleLike}
            >
              <Heart className="h-6 w-6 text-white" />
              <span className="text-white font-semibold">Connect</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
