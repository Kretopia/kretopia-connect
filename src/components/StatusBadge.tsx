import { type StatusResult } from "@/lib/statusEngine";
import { Shield, Award, Crown, Star, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_ICONS = {
  hobbyist: Shield,
  freelancer: Zap,
  thriver: Award,
  professional: Star,
  celebrity: Crown,
  icon: Sparkles,
};

interface StatusBadgeProps {
  status: StatusResult;
  showPoints?: boolean;
  showSocialProof?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ status, showPoints = false, showSocialProof = false, size = "sm" }: StatusBadgeProps) {
  const Icon = TIER_ICONS[status.tier] || Shield;
  const isSmall = size === "sm";

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 backdrop-blur-sm",
      status.tier === "icon" && "border-primary/40 bg-primary/5",
      status.tier === "celebrity" && "border-foreground/30 bg-foreground/5",
      status.tier === "professional" && "border-accent/40 bg-accent/5",
      status.tier === "thriver" && "border-primary/30 bg-primary/5",
      status.tier === "freelancer" && "border-border bg-muted/50",
      status.tier === "hobbyist" && "border-border bg-muted/30",
    )}>
      <Icon className={cn(
        status.color,
        isSmall ? "h-3 w-3" : "h-4 w-4",
      )} />
      <span className={cn(
        "font-semibold",
        status.color,
        isSmall ? "text-[10px]" : "text-xs",
      )}>
        {showSocialProof && status.socialProofLabel ? status.socialProofLabel : status.label}
      </span>
      {showPoints && (
        <span className={cn(
          "text-muted-foreground",
          isSmall ? "text-[9px]" : "text-[10px]",
        )}>
          {status.metrics.verifiedCredits} verified
        </span>
      )}
    </div>
  );
}
