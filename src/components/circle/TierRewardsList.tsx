import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NetworkTierMeta } from "@/lib/referralEngine";

/**
 * One circular medallion, reused for the current-tier hero (large) and
 * every row in the Tier Rewards list (small) -- a single visual language
 * for "this is a tier badge" instead of a plain icon-plus-label row, and
 * one place to keep it consistent rather than two hand-built treatments.
 */
export const TierMedallion = ({
  tier,
  size = "md",
  active = true,
}: {
  tier: NetworkTierMeta;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) => {
  const dims = size === "lg" ? "h-16 w-16" : size === "md" ? "h-11 w-11" : "h-9 w-9";
  const iconDims = size === "lg" ? "h-7 w-7" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full flex items-center justify-center border bg-gradient-to-br",
        dims,
        active ? tier.gradient : "from-muted/30 to-muted/5",
        active ? tier.ringClass.replace("ring-", "border-") : "border-border",
      )}
    >
      <tier.icon className={cn(iconDims, active ? tier.color : "text-muted-foreground")} aria-hidden />
    </div>
  );
};

interface TierRewardsListProps {
  tiers: NetworkTierMeta[];
  activeTier: NetworkTierMeta["tier"];
  referralCount: number;
  /** How many tiers show before "See more". Tiers keep their original order. */
  collapsedCount?: number;
}

export function TierRewardsList({ tiers, activeTier, referralCount, collapsedCount = 3 }: TierRewardsListProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const canCollapse = tiers.length > collapsedCount;
  const visibleTiers = canCollapse && !expanded ? tiers.slice(0, collapsedCount) : tiers;

  return (
    <div className="space-y-3">
      <div id={listId} className="space-y-3">
        {visibleTiers.map((tier) => {
          const isActive = tier.tier === activeTier;
          const isUnlocked = referralCount >= tier.minReferrals;
          return (
            <Card
              key={tier.tier}
              className={cn(
                "p-4 rounded-2xl shadow-none border-border/60 transition-colors",
                isActive && "border-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.05)] ring-1 ring-[hsl(var(--energy)/0.2)]",
                isUnlocked && !isActive && "bg-muted/10",
                !isUnlocked && "opacity-50",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <TierMedallion tier={tier} size="sm" active={isUnlocked} />
                  <div>
                    <span className={cn("font-bold", isActive ? tier.color : "text-foreground")}>{tier.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{tier.minReferrals}+ invites</span>
                  </div>
                  {isActive && <Badge variant="default" className="text-[9px] px-1.5">You</Badge>}
                </div>
                {isUnlocked && !isActive && <Badge variant="secondary" className="text-[9px]">Unlocked</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mb-3 italic">{tier.tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                {tier.perks.map((perk) => (
                  <span key={perk} className="text-[10px] px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground font-medium">
                    {perk}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {canCollapse && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5 rounded-xl"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "See more"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </Button>
      )}
    </div>
  );
}
