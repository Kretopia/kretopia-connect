import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const OGPromotionBanner = () => {
  const { user } = useAuth();
  const [promotionInfo, setPromotionInfo] = useState<{
    isOG: boolean;
    expiresAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchPromotionInfo = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("badge, og_promotion_used, og_promotion_expires_at, subscription_tier")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.badge === 'og' && data.og_promotion_used && data.og_promotion_expires_at) {
        const expiresAt = new Date(data.og_promotion_expires_at);
        const now = new Date();
        
        // Only show if promotion is still active
        if (expiresAt > now && data.subscription_tier === 'creator_pro') {
          setPromotionInfo({
            isOG: true,
            expiresAt: data.og_promotion_expires_at,
          });
        }
      }
    };

    fetchPromotionInfo();
  }, [user]);

  if (!promotionInfo?.isOG) return null;

  const expiresAt = new Date(promotionInfo.expiresAt!);
  const daysLeft = Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Alert className="border-primary/50 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 mb-6">
      <Crown className="h-5 w-5 text-primary" />
      <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary">
            <Sparkles className="h-3 w-3 mr-1" />
            OG Member Bonus
          </Badge>
          <span className="text-sm">
            You're enjoying free Creator+ membership! {daysLeft} days remaining.
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Expires {expiresAt.toLocaleDateString()}
        </span>
      </AlertDescription>
    </Alert>
  );
};
