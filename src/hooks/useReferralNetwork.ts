import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getNetworkTier, type NetworkTierMeta } from "@/lib/referralEngine";

interface ReferralNetworkData {
  referralCount: number;
  activeReferralCount: number;
  totalNetworkSize: number;
  tier: NetworkTierMeta;
  freeProMonthsEarned: number;
  freeProMonthsUsed: number;
  feeDiscount: number;
  commissionRate: number;
  commissionEarned: number;
  longestChain: number;
  loading: boolean;
}

export function useReferralNetwork(): ReferralNetworkData {
  const { user } = useAuth();
  const [data, setData] = useState<ReferralNetworkData>({
    referralCount: 0,
    activeReferralCount: 0,
    totalNetworkSize: 0,
    tier: getNetworkTier(0),
    freeProMonthsEarned: 0,
    freeProMonthsUsed: 0,
    feeDiscount: 0,
    commissionRate: 0,
    commissionEarned: 0,
    longestChain: 0,
    loading: true,
  });

  useEffect(() => {
    if (!user) return;

    const fetchNetwork = async () => {
      try {
        // Try to get existing network data
        const { data: networkData } = await supabase
          .from("referral_network")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        // Sum total people invited via invite codes (current_uses)
        const { data: inviteData } = await supabase
          .from("invites")
          .select("current_uses")
          .eq("inviter_id", user.id)
          .gt("current_uses", 0);

        const inviteTotal = (inviteData || []).reduce((sum, inv) => sum + (inv.current_uses || 0), 0);
        const totalReferrals = (networkData?.referral_count || 0) + inviteTotal;
        const tier = getNetworkTier(totalReferrals);

        setData({
          referralCount: totalReferrals,
          activeReferralCount: networkData?.active_referral_count || 0,
          totalNetworkSize: networkData?.total_network_size || 0,
          tier,
          freeProMonthsEarned: networkData?.free_pro_months_earned || 0,
          freeProMonthsUsed: networkData?.free_pro_months_used || 0,
          feeDiscount: Number(networkData?.fee_discount_percent || 0),
          commissionRate: Number(networkData?.commission_rate || 0),
          commissionEarned: Number(networkData?.commission_earned || 0),
          longestChain: networkData?.longest_chain || 0,
          loading: false,
        });
      } catch (err) {
        console.error("Error fetching referral network:", err);
        setData(prev => ({ ...prev, loading: false }));
      }
    };

    fetchNetwork();
  }, [user]);

  return data;
}
