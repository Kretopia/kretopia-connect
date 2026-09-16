import { useCallback } from "react";
import { useFeatureUsage } from "@/hooks/useFeatureUsage";
import { type FreeTierFeature, getFeatureDisplayName } from "@/lib/subscriptionLimits";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Action-level feature gate hook.
 * Returns a `guard()` function that checks limits AND increments usage.
 * Use this around actual create/submit actions (invoices, milestones, etc.)
 * 
 * Usage:
 *   const { canUse, guard, remaining, cap } = useFeatureGate("invoices");
 *   const handleCreate = async () => {
 *     if (!guard()) return; // blocks + shows toast if limit reached
 *     // ... actual creation logic
 *   };
 */
export function useFeatureGate(feature: FreeTierFeature) {
  const navigate = useNavigate();
  const { usage, cap, remaining, canUse, isPro, increment, bonusUses } = useFeatureUsage(feature);

  const guard = useCallback((): boolean => {
    // Unlimited access
    if (cap === -1) return true;

    if (!canUse) {
      const displayName = getFeatureDisplayName(feature);
      toast.error(`Monthly limit reached`, {
        description: `You've used all ${cap} free ${displayName} this month. Upgrade to Pro for unlimited access.`,
        action: {
          label: "Upgrade",
          onClick: () => navigate("/subscription"),
        },
      });
      return false;
    }

    // Increment usage count
    increment();
    return true;
  }, [cap, canUse, feature, increment, navigate]);

  return {
    canUse,
    guard,
    usage,
    cap,
    remaining,
    isPro,
  };
}
