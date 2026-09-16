import { Badge } from "@/components/ui/badge";
import { Shield, Star, Award, Crown, Sparkles } from "lucide-react";
import { type StatusTier } from "@/lib/statusEngine";

const TIER_ICONS: Record<StatusTier, any> = {
  hobbyist: Sparkles,
  freelancer: Shield,
  thriver: Shield,
  professional: Star,
  celebrity: Award,
  icon: Crown,
};

const TIER_COLORS: Record<StatusTier, string> = {
  hobbyist: "from-muted-foreground to-muted-foreground",
  freelancer: "from-slate-400 to-slate-500",
  thriver: "from-primary to-primary",
  professional: "from-accent to-accent",
  celebrity: "from-foreground to-foreground",
  icon: "from-primary to-accent",
};

interface VerificationBadgeProps {
  tier?: StatusTier;
  className?: string;
  showLabel?: boolean;
  /** @deprecated use tier prop instead */
  level?: number;
  /** @deprecated use tier prop instead */
  xp?: number;
}

export function VerificationBadge({ tier = "hobbyist", className = "", showLabel = true }: VerificationBadgeProps) {
  const Icon = TIER_ICONS[tier];
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  
  return (
    <Badge 
      className={`gap-1.5 bg-gradient-to-r ${TIER_COLORS[tier]} text-white border-0 ${className}`}
      title={tierLabel}
    >
      <Icon className="w-3.5 h-3.5" />
      {showLabel && <span className="font-semibold">{tierLabel}</span>}
    </Badge>
  );
}
