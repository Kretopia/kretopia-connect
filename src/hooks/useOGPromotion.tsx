import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useOGPromotion = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasChecked, setHasChecked] = useState(false);
  const [promotionStatus, setPromotionStatus] = useState<{
    isOG: boolean;
    promotionActive: boolean;
    expiresAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user || hasChecked) return;

    const checkAndActivatePromotion = async () => {
      try {
        // Get profile to check OG status
        const { data: profile } = await supabase
          .from("profiles")
          .select("badge, subscription_tier, og_promotion_used, og_promotion_expires_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile || profile.badge !== 'og') {
          setHasChecked(true);
          return;
        }

        setPromotionStatus({
          isOG: true,
          promotionActive: profile.og_promotion_used || false,
          expiresAt: profile.og_promotion_expires_at,
        });

        // If OG and promotion not used, activate it automatically
        if (!profile.og_promotion_used) {
          const { data, error } = await supabase.functions.invoke(
            "activate-og-promotion"
          );

          if (error) {
            console.error("Error activating OG promotion:", error);
          } else if (data?.success) {
            toast({
              title: "OG Member Bonus Activated!",
              description: "You've been upgraded to Creator+ for 2 months as a thank you for being an OG member!",
              duration: 10000,
            });

            setPromotionStatus({
              isOG: true,
              promotionActive: true,
              expiresAt: data.expiresAt,
            });

            // Refresh profile
            window.location.reload();
          }
        } else {
          // Check if promotion has expired
          const expiresAt = profile.og_promotion_expires_at 
            ? new Date(profile.og_promotion_expires_at) 
            : null;
          const now = new Date();

          if (expiresAt && now > expiresAt && profile.subscription_tier === 'creator_pro') {
            // Trigger expiration check
            await supabase.functions.invoke("activate-og-promotion");
          }
        }

        setHasChecked(true);
      } catch (error) {
        console.error("Error in OG promotion check:", error);
        setHasChecked(true);
      }
    };

    checkAndActivatePromotion();
  }, [user, hasChecked, toast]);

  return promotionStatus;
};
