import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Shield, Zap, Award, Star, Crown, Sparkles } from "lucide-react";
import { getAllTiers } from "@/lib/statusEngine";
import { useNavigate } from "react-router-dom";

interface TierBenefitsComparisonProps {
  currentPoints: number;
}

export const TierBenefitsComparison = ({ currentPoints }: TierBenefitsComparisonProps) => {
  const navigate = useNavigate();
  const allTiers = getAllTiers();
  
  // Use currentPoints as a rough tier index proxy (0-5)
  const currentTierIdx = Math.min(Math.floor(currentPoints / 1000), allTiers.length - 1);

  const TIER_ICONS = [Shield, Zap, Award, Star, Crown, Sparkles];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allTiers.map((tier, idx) => {
          const isCurrentTier = idx === currentTierIdx;
          const isUnlocked = idx <= currentTierIdx;
          const Icon = TIER_ICONS[idx];

          return (
            <Card
              key={tier.tier}
              className={`relative overflow-hidden ${
                isCurrentTier ? "ring-2 ring-primary shadow-xl" : ""
              }`}
            >
              <div className={`h-28 bg-gradient-to-br ${tier.gradient} relative flex items-center justify-center`}>
                <div className="text-center">
                  <Icon className={`h-8 w-8 mx-auto mb-1 ${tier.color}`} />
                  <h3 className={`text-lg font-bold ${tier.color}`}>{tier.label}</h3>
                  {tier.socialProofLabel && (
                    <p className="text-[10px] text-muted-foreground">{tier.socialProofLabel}</p>
                  )}
                </div>
              </div>

              <div className="p-4">
                {isCurrentTier && (
                  <Badge className="mb-3 w-full justify-center">Your Status</Badge>
                )}

                <div className="space-y-2 mb-4">
                  {tier.perks.map((perk, perkIdx) => (
                    <div key={perkIdx} className="flex items-start gap-2 text-sm">
                      <Check
                        className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                          isUnlocked ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <span className={`text-xs ${isUnlocked ? "" : "text-muted-foreground"}`}>
                        {perk}
                      </span>
                    </div>
                  ))}
                </div>

                {!isUnlocked && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Build your reputation to unlock</span>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
