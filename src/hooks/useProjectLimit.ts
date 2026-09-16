import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { hasProAccess } from "@/lib/subscriptionConfig";

const FREE_MONTHLY_PROJECT_LIMIT = 1;

export function useProjectLimit() {
  const { user, subscriptionInfo } = useAuth();
  const isPro = hasProAccess(subscriptionInfo.tier as any);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || isPro) {
      setLoading(false);
      return;
    }
    checkMonthlyUsage();
  }, [user, isPro]);

  const checkMonthlyUsage = async () => {
    if (!user) return;
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .gte('created_at', startOfMonth.toISOString());

      if (!error) {
        setMonthlyCount(count || 0);
      }
    } catch (e) {
      console.error('Error checking project limit:', e);
    } finally {
      setLoading(false);
    }
  };

  const canCreateProject = isPro || monthlyCount < FREE_MONTHLY_PROJECT_LIMIT;
  const remaining = isPro ? Infinity : Math.max(0, FREE_MONTHLY_PROJECT_LIMIT - monthlyCount);

  return {
    canCreateProject,
    monthlyCount,
    limit: FREE_MONTHLY_PROJECT_LIMIT,
    remaining,
    isPro,
    loading,
    refresh: checkMonthlyUsage,
  };
}
