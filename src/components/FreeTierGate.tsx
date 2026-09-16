import { useNavigate } from "react-router-dom";
import { Crown, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFeatureUsage } from "@/hooks/useFeatureUsage";
import { type FreeTierFeature, getFeatureDisplayName } from "@/lib/subscriptionLimits";
import { useAuth } from "@/hooks/useAuth";
import { hasCreatorProAccess } from "@/lib/subscriptionConfig";

interface FreeTierGateProps {
  feature: FreeTierFeature;
  featureLabel: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Replaces ProGate: free users get limited monthly uses.
 * Shows usage bar when approaching limit, blocks when exhausted.
 */
export function FreeTierGate({ feature, featureLabel, description, children }: FreeTierGateProps) {
  const navigate = useNavigate();
  const { usage, cap, remaining, canUse, isPro } = useFeatureUsage(feature);
  const { subscriptionInfo } = useAuth();
  const isEnterprise = hasCreatorProAccess(subscriptionInfo.tier as any);

  // Enterprise/Founder users with unlimited (-1) see content directly
  if (cap === -1) return <>{children}</>;

  // Free user exhausted their cap
  if (!canUse) {
    return (
      <div className="relative min-h-[250px]">
        <div className="pointer-events-none select-none filter blur-[6px] opacity-40 saturate-50">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-card/95 backdrop-blur-md border border-primary/20 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl shadow-primary/10">
            <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
              <Crown className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-1">Monthly Limit Reached</h3>
            <p className="text-sm text-muted-foreground mb-2">
              You've used all <strong>{cap} {getFeatureDisplayName(feature)}</strong> this month.
            </p>
            <p className="text-xs text-muted-foreground mb-5">
              {description || (isPro 
                ? `Upgrade to Creator+ for higher limits on ${getFeatureDisplayName(feature)}.`
                : `Upgrade to Creator for more ${getFeatureDisplayName(feature)}.`
              )}
            </p>
            <Button
              onClick={() => navigate("/subscription")}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isPro ? "Upgrade to Creator+" : "Upgrade to Creator"}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-3">
              {isPro ? "$59/month · Creator+" : "$29/month · Cancel anytime"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Free user with remaining uses — show usage bar
  const usagePercent = cap > 0 ? (usage / cap) * 100 : 0;
  const isNearLimit = remaining <= Math.ceil(cap * 0.34); // warn at ~1/3 remaining

  return (
    <div>
      {isNearLimit && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mb-4">
          <Zap className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-foreground">
                {remaining} of {cap} free {getFeatureDisplayName(feature)} left this month
              </p>
              <button 
                onClick={() => navigate("/subscription")}
                className="text-xs font-semibold text-primary hover:underline shrink-0 ml-2"
              >
                Go Creator →
              </button>
            </div>
            <Progress value={usagePercent} className="h-1.5" />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Inline usage badge for showing remaining uses on buttons/actions.
 */
interface UsageBadgeProps {
  feature: FreeTierFeature;
}

export function UsageBadge({ feature }: UsageBadgeProps) {
  const { remaining, isPro, cap } = useFeatureUsage(feature);
  
  if (isPro) return null;
  
  return (
    <span className="text-[10px] font-medium text-muted-foreground ml-1">
      ({remaining}/{cap})
    </span>
  );
}
