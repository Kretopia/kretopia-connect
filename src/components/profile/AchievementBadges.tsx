import { Badge } from "@/components/ui/badge";
import { 
  Trophy, Award, Music, Film, Star, Users, 
  Verified, Crown, Sparkles, TrendingUp, Disc,
  Youtube, Instagram, Radio
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AchievementBadgesProps {
  achievements: string[];
  tier?: 'verified' | 'industry' | 'elite' | string;
  size?: 'sm' | 'md' | 'lg';
  showAll?: boolean;
  maxDisplay?: number;
}

const ACHIEVEMENT_CONFIG: Record<string, {
  icon: typeof Trophy;
  color: string;
  bgColor: string;
  description: string;
  priority: number;
}> = {
  "Grammy Winner": {
    icon: Trophy,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/20 border-yellow-500/50",
    description: "Recording Academy Grammy Award Winner",
    priority: 1
  },
  "Grammy Nominated": {
    icon: Trophy,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/30",
    description: "Recording Academy Grammy Nominee",
    priority: 2
  },
  "Oscar Winner": {
    icon: Award,
    color: "text-amber-500",
    bgColor: "bg-amber-500/20 border-amber-500/50",
    description: "Academy Award Winner",
    priority: 1
  },
  "Oscar Nominated": {
    icon: Award,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    description: "Academy Award Nominee",
    priority: 2
  },
  "Emmy Winner": {
    icon: Award,
    color: "text-primary",
    bgColor: "bg-primary/20 border-primary/50",
    description: "Emmy Award Winner",
    priority: 1
  },
  "Emmy Nominated": {
    icon: Award,
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/30",
    description: "Emmy Award Nominee",
    priority: 2
  },
  "Billboard Charting": {
    icon: TrendingUp,
    color: "text-red-500",
    bgColor: "bg-red-500/20 border-red-500/50",
    description: "Charted on Billboard",
    priority: 3
  },
  "IMDB Credited": {
    icon: Film,
    color: "text-orange-500",
    bgColor: "bg-orange-500/20 border-orange-500/50",
    description: "Professional credits on IMDB",
    priority: 4
  },
  "Verified Artist": {
    icon: Verified,
    color: "text-primary",
    bgColor: "bg-primary/20 border-primary/50",
    description: "Verified on Spotify/Apple Music",
    priority: 3
  },
  "10M+ Streams": {
    icon: Music,
    color: "text-green-500",
    bgColor: "bg-green-500/20 border-green-500/50",
    description: "Over 10 million streams",
    priority: 3
  },
  "1M+ Streams": {
    icon: Music,
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/30",
    description: "Over 1 million streams",
    priority: 4
  },
  "1M+ Followers": {
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/20 border-primary/50",
    description: "Over 1 million followers",
    priority: 3
  },
  "100K+ Followers": {
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/30",
    description: "Over 100K followers",
    priority: 5
  },
  "Major Label": {
    icon: Disc,
    color: "text-primary",
    bgColor: "bg-primary/20 border-primary/50",
    description: "Signed to a major record label",
    priority: 4
  },
  "Award Winning": {
    icon: Star,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10 border-yellow-500/30",
    description: "Industry award recipient",
    priority: 5
  },
  "Published Author": {
    icon: Award,
    color: "text-teal-500",
    bgColor: "bg-teal-500/20 border-teal-500/50",
    description: "Published author or writer",
    priority: 5
  },
  "Festival Official Selection": {
    icon: Film,
    color: "text-primary",
    bgColor: "bg-primary/20 border-primary/50",
    description: "Selected for major film festival",
    priority: 5
  },
  "Press Featured": {
    icon: Award,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/20 border-emerald-500/50",
    description: "Featured in press & media publications",
    priority: 4
  }
};

const TIER_CONFIG = {
  verified: {
    icon: Verified,
    color: "text-primary",
    bgColor: "bg-primary/20 border-primary/50",
    label: "Verified"
  },
  industry: {
    icon: Award,
    color: "text-amber-500",
    bgColor: "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50",
    label: "Industry Verified"
  },
  elite: {
    icon: Crown,
    color: "text-yellow-500",
    bgColor: "bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border-yellow-500/50",
    label: "Elite Verified"
  }
};

const sizeClasses = {
  sm: "h-5 gap-1 text-xs px-1.5",
  md: "h-6 gap-1.5 text-xs px-2",
  lg: "h-7 gap-2 text-sm px-3"
};

const iconSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4"
};

export function AchievementBadges({ 
  achievements = [], 
  tier,
  size = 'md',
  showAll = false,
  maxDisplay = 3
}: AchievementBadgesProps) {
  // Early return if no achievements and no tier
  if (achievements.length === 0 && !tier) {
    return null;
  }
  
  // Normalize tier to match config keys
  const normalizedTier = tier as 'verified' | 'industry' | 'elite' | undefined;
  // Sort achievements by priority
  const sortedAchievements = [...achievements].sort((a, b) => {
    const priorityA = ACHIEVEMENT_CONFIG[a]?.priority ?? 10;
    const priorityB = ACHIEVEMENT_CONFIG[b]?.priority ?? 10;
    return priorityA - priorityB;
  });

  const displayAchievements = showAll 
    ? sortedAchievements 
    : sortedAchievements.slice(0, maxDisplay);
  
  const remainingCount = sortedAchievements.length - displayAchievements.length;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Tier Badge */}
        {normalizedTier && TIER_CONFIG[normalizedTier] && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`${sizeClasses[size]} ${TIER_CONFIG[normalizedTier].bgColor} ${TIER_CONFIG[normalizedTier].color} border`}
              >
                {(() => {
                  const TierIcon = TIER_CONFIG[normalizedTier].icon;
                  return <TierIcon className={iconSizes[size]} />;
                })()}
                <span className="font-semibold">{TIER_CONFIG[normalizedTier].label}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{TIER_CONFIG[normalizedTier].label} Creator</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Achievement Badges */}
        {displayAchievements.map((achievement) => {
          const config = ACHIEVEMENT_CONFIG[achievement];
          if (!config) return null;
          
          const Icon = config.icon;
          
          return (
            <Tooltip key={achievement}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={`${sizeClasses[size]} ${config.bgColor} ${config.color} border`}
                >
                  <Icon className={iconSizes[size]} />
                  <span className="font-medium">{achievement}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Remaining count */}
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`${sizeClasses[size]} bg-muted/50 text-muted-foreground`}
              >
                <Sparkles className={iconSizes[size]} />
                <span>+{remainingCount}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {sortedAchievements.slice(maxDisplay).map(a => (
                  <p key={a} className="text-xs">{a}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
