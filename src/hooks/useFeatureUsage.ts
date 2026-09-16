import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  type FreeTierFeature, 
  FREE_TIER_MONTHLY_CAPS, 
  getMonthlyCapForFeature 
} from "@/lib/subscriptionLimits";
import { hasProAccess } from "@/lib/subscriptionConfig";

/**
 * Hook to track monthly usage of a gated feature.
 * Uses localStorage for lightweight tracking (no extra DB table needed).
 * Resets at start of each calendar month.
 */
export function useFeatureUsage(feature: FreeTierFeature) {
  const { user, subscriptionInfo } = useAuth();
  const tier = (subscriptionInfo.tier || 'free') as 'free' | 'pro' | 'creator_pro' | 'founder';
  const isPro = hasProAccess(tier);
  const [usage, setUsage] = useState(0);
  const [bonusUses, setBonusUses] = useState(0);

  const storageKey = user ? `thrivein_usage_${user.id}_${feature}` : null;
  const bonusKey = user ? `thrivein_bonus_${user.id}_${feature}` : null;

  const getMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
  };

  // Load usage + bonus from localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.month !== getMonthKey()) {
          localStorage.removeItem(storageKey);
          setUsage(0);
        } else {
          setUsage(parsed.count || 0);
        }
      }
    } catch {
      setUsage(0);
    }

    // Load bonus uses purchased via XP shop
    if (bonusKey) {
      try {
        const bonusStored = localStorage.getItem(bonusKey);
        if (bonusStored) {
          const parsed = JSON.parse(bonusStored);
          if (parsed.month === getMonthKey()) {
            setBonusUses(parsed.count || 0);
          } else {
            localStorage.removeItem(bonusKey);
            setBonusUses(0);
          }
        }
      } catch {
        setBonusUses(0);
      }
    }
  }, [storageKey, bonusKey]);

  const baseCap = getMonthlyCapForFeature(feature, tier);
  const cap = baseCap === -1 ? -1 : baseCap + bonusUses;
  const remaining = cap === -1 ? -1 : Math.max(0, cap - usage);
  const canUse = cap === -1 || usage < cap;

  const increment = useCallback(() => {
    if (!storageKey || cap === -1) return;
    const newCount = usage + 1;
    setUsage(newCount);
    localStorage.setItem(storageKey, JSON.stringify({
      month: getMonthKey(),
      count: newCount,
    }));
  }, [storageKey, usage, cap]);

  return {
    usage,
    cap,
    remaining,
    canUse,
    isPro,
    increment,
    bonusUses,
  };
}
