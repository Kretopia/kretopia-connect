import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, Globe, Share2, Check, UserPlus, LogIn, DollarSign, MessageSquare, ShieldCheck, ArrowLeft, Settings, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HubHeaderProps {
  circle: any;
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
  user: any;
  copied: boolean;
  leaderProfile?: { full_name?: string; avatar_url?: string } | null;
  onBack: () => void;
  onJoin: () => void;
  onShare: () => void;
  onMessage: () => void;
  onManage: () => void;
}

const TIER_THRESHOLDS = [
  { count: 10, label: "Spark" },
  { count: 50, label: "Crew" },
  { count: 250, label: "Networker" },
  { count: 1000, label: "Mogul" },
];

function getProgression(count: number) {
  const next = TIER_THRESHOLDS.find(t => count < t.count);
  if (!next) return { label: "Mogul", remaining: 0, current: "Mogul" };
  const prevIdx = TIER_THRESHOLDS.indexOf(next) - 1;
  const current = prevIdx >= 0 ? TIER_THRESHOLDS[prevIdx].label : "Seedling";
  return { label: next.label, remaining: next.count - count, current };
}

export function CircleHubHeader({
  circle, memberCount, isMember, isAdmin, user, copied, leaderProfile,
  onBack, onJoin, onShare, onMessage, onManage,
}: HubHeaderProps) {
  const progression = getProgression(memberCount);
  const tagline = circle.tagline || (circle.is_verified ? "Verified Creative Circle" : "Build, collaborate, and grow together");

  return (
    <div className="relative">
      {/* Cover */}
      <div className="relative h-40 sm:h-52 md:h-64 w-full overflow-hidden bg-gradient-to-br from-primary/20 via-accent/10 to-background">
        {circle.cover_image_url || circle.cover_url ? (
          <img
            src={circle.cover_image_url || circle.cover_url}
            alt={`${circle.title} cover`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">
            {circle.icon_emoji || "💬"}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-3">
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50"
              onClick={onManage}
              aria-label="Manage circle"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content over cover */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="flex items-end gap-3 mb-3">
          <div className="w-20 h-20 rounded-2xl border-4 border-background bg-card shadow-xl overflow-hidden shrink-0 flex items-center justify-center text-3xl">
            {circle.cover_url ? (
              <img src={circle.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{circle.icon_emoji || "💬"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight truncate">
                {circle.title}
              </h1>
              {circle.is_verified && (
                <ShieldCheck className="h-5 w-5 text-accent shrink-0" aria-label="Verified Circle" />
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{tagline}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant="secondary" className="gap-1 text-[10px] h-5">
            {circle.is_private ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
            {circle.is_private ? "Private" : "Public"}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5">
            {memberCount.toLocaleString()} {memberCount === 1 ? "member" : "members"}
          </Badge>
          {circle.is_paid && circle.price_monthly > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 border-accent/40 text-accent gap-1">
              <DollarSign className="h-2.5 w-2.5" />
              {circle.price_monthly}/mo
            </Badge>
          )}
          {circle.is_verified && (
            <Badge className="text-[10px] h-5 bg-accent/15 text-accent border-0 gap-1">
              <ShieldCheck className="h-2.5 w-2.5" /> Verified
            </Badge>
          )}
        </div>

        {/* Progression */}
        {progression.remaining > 0 && (
          <div className="flex items-center gap-2 mb-3 text-[11px]">
            <Crown className="h-3 w-3 text-accent shrink-0" />
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{progression.remaining}</span> more to reach{" "}
              <span className="font-semibold text-accent">{progression.label}</span>
            </span>
          </div>
        )}

        {/* Leader preview */}
        {leaderProfile && (
          <button
            onClick={() => circle.created_by && (window.location.href = `/profile/${circle.created_by}`)}
            className="flex items-center gap-2 mb-3 group"
          >
            <Avatar className="h-6 w-6 border border-border/50">
              <AvatarImage src={leaderProfile.avatar_url || ""} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {(leaderProfile.full_name || "?")[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
              Led by <span className="font-medium text-foreground">{leaderProfile.full_name || "Unknown"}</span>
            </span>
          </button>
        )}

        {/* CTAs */}
        <div className="flex items-center gap-2">
          {!isMember ? (
            <Button variant="gradient" className="flex-1 gap-2" onClick={onJoin}>
              {!user ? (
                <><LogIn className="h-4 w-4" /> Sign in to join</>
              ) : circle.is_paid && circle.price_monthly > 0 ? (
                <><DollarSign className="h-4 w-4" /> Join · ${circle.price_monthly}/mo</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Join Circle</>
              )}
            </Button>
          ) : (
            <Button variant="outline" className="flex-1 gap-2" onClick={onMessage}>
              <MessageSquare className="h-4 w-4" /> Open Chat
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={onShare} aria-label="Share circle">
            {copied ? <Check className="h-4 w-4 text-accent" /> : <Share2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
