import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  Award,
  Music,
  Film,
  Users,
  Globe,
  Sparkles,
  ExternalLink,
  Database,
  BadgeCheck,
  Newspaper
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface VerifiedCredential {
  type: 'award' | 'credit' | 'certification' | 'social' | 'streams' | 'press';
  source: string;
  title: string;
  value?: string;
  verified: boolean;
  url?: string;
}

interface VerificationReportCardProps {
  verificationTier?: string;
  verificationScore?: number;
  verifiedCredentials?: VerifiedCredential[];
  achievementBadges?: string[];
  verifiedAt?: string;
  breakdown?: {
    awards: number;
    credits: number;
    social: number;
    streams: number;
    press: number;
  };
  isOwnProfile?: boolean;
  onReVerify?: () => void;
}

const SOURCES_CHECKED = [
  { name: 'IMDB', icon: Film, category: 'credits' },
  { name: 'Discogs', icon: Music, category: 'credits' },
  { name: 'AllMusic', icon: Music, category: 'credits' },
  { name: 'Spotify', icon: Music, category: 'streams' },
  { name: 'Grammy Database', icon: Award, category: 'awards' },
  { name: 'Billboard', icon: Award, category: 'awards' },
  { name: 'Instagram', icon: Users, category: 'social' },
  { name: 'YouTube', icon: Globe, category: 'social' },
  { name: 'LinkedIn', icon: Users, category: 'social' },
  { name: 'Press Links', icon: Newspaper, category: 'press' },
  { name: 'Web Search', icon: Globe, category: 'press' },
];

export function VerificationReportCard({
  verificationTier = 'verified',
  verificationScore = 0,
  verifiedCredentials = [],
  achievementBadges = [],
  verifiedAt,
  breakdown,
  isOwnProfile = false,
  onReVerify,
}: VerificationReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'award': return <Award className="h-4 w-4" />;
      case 'credit': return <Film className="h-4 w-4" />;
      case 'social': return <Users className="h-4 w-4" />;
      case 'streams': return <Music className="h-4 w-4" />;
      case 'press': return <Newspaper className="h-4 w-4" />;
      default: return <BadgeCheck className="h-4 w-4" />;
    }
  };

  const getTierStyles = (tier: string) => {
    switch (tier) {
      case 'elite': 
        return {
          card: 'bg-gradient-to-br from-amber-950/40 via-background to-yellow-950/30 border-amber-500/40',
          badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-semibold',
          accent: 'text-amber-400',
          glow: 'shadow-amber-500/20'
        };
      case 'industry': 
        return {
          card: 'bg-gradient-to-br from-primary/40 via-background to-primary/30 border-primary/40',
          badge: 'bg-gradient-to-r from-primary to-primary text-white font-semibold',
          accent: 'text-primary',
          glow: 'shadow-primary/20'
        };
      default: 
        return {
          card: 'bg-gradient-to-br from-slate-900/60 via-background to-slate-800/40 border-border/60',
          badge: 'bg-primary text-primary-foreground font-semibold',
          accent: 'text-primary',
          glow: 'shadow-primary/10'
        };
    }
  };

  const verifiedCount = verifiedCredentials.filter(c => c.verified).length;
  const tierStyles = getTierStyles(verificationTier);

  return (
    <Card className={cn(
      "overflow-hidden border shadow-lg",
      tierStyles.card,
      tierStyles.glow
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className={cn("p-1.5 rounded-lg bg-primary/10", tierStyles.accent)}>
              <Shield className="h-4 w-4" />
            </div>
            Smart Verification Report
          </CardTitle>
          <Badge className={cn("text-xs px-2.5 py-0.5", tierStyles.badge)}>
            {verificationTier === 'verified' ? 'VERIFIED' : verificationTier.toUpperCase()}
          </Badge>
        </div>
        {verifiedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Verified on {format(new Date(verifiedAt), 'MMM d, yyyy')}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score Overview */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 text-center">
            <p className={cn("text-2xl font-bold", tierStyles.accent)}>{verificationScore}</p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
          <div className="p-3 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 text-center">
            <p className="text-2xl font-bold text-primary">{verifiedCount}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="p-3 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 text-center">
            <p className="text-2xl font-bold text-foreground">{SOURCES_CHECKED.length}</p>
            <p className="text-xs text-muted-foreground">Sources</p>
          </div>
        </div>

        {/* Achievement Badges - Only show if unique badges exist */}
        {achievementBadges.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Earned Achievements
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(achievementBadges)].map((badge, idx) => (
                <Badge key={idx} className="text-xs gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25">
                  <Award className="h-3 w-3" />
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Breakdown */}
        {breakdown && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Score Breakdown</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Award className="h-3.5 w-3.5" /> Awards
                </span>
                <span className="font-semibold text-foreground">+{breakdown.awards}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Film className="h-3.5 w-3.5" /> Credits
                </span>
                <span className="font-semibold text-foreground">+{breakdown.credits}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Social
                </span>
                <span className="font-semibold text-foreground">+{breakdown.social}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Music className="h-3.5 w-3.5" /> Streams
                </span>
                <span className="font-semibold text-foreground">+{breakdown.streams}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40 col-span-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Newspaper className="h-3.5 w-3.5" /> Press & Media
                </span>
                <span className="font-semibold text-foreground">+{breakdown.press || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-2 bg-background/50 hover:bg-background/80">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  View Full Report
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Sources Checked */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Database className="h-4 w-4 text-muted-foreground" />
                Sources Checked
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {SOURCES_CHECKED.map((source, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg text-xs bg-background/60 border border-border/30"
                  >
                    <source.icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground">{source.name}</span>
                    <CheckCircle2 className="h-3 w-3 text-primary ml-auto" />
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Credentials */}
            {verifiedCredentials.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Verified Credentials</p>
                <div className="space-y-2">
                  {verifiedCredentials.map((cred, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-lg text-xs border",
                        cred.verified 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-muted/50 border-border/50"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        cred.verified ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {getTypeIcon(cred.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{cred.title}</span>
                          {cred.verified ? (
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                          ) : (
                            <XCircle className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          {cred.source} {cred.value && `• ${cred.value}`}
                        </p>
                      </div>
                      {cred.url && (
                        <a 
                          href={cred.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-background/80 rounded-lg transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How It Works */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-2">
              <p className="text-xs font-medium text-foreground">How AI Verification Works</p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Thrive searches industry databases (IMDB, Discogs, Grammy)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Social profiles analyzed for follower counts & verification
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Streaming platforms checked for artist presence
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Web search for press mentions and publications
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  All credentials cross-referenced for accuracy
                </li>
              </ul>
            </div>

            {/* Re-verify Button */}
            {isOwnProfile && onReVerify && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2 bg-background/50 hover:bg-background/80"
                onClick={onReVerify}
              >
                <Shield className="h-4 w-4" />
                Re-run Verification
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
