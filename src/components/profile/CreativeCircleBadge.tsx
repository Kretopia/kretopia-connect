import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getNetworkTier } from "@/lib/referralEngine";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CreativeCircleBadgeProps {
  userId: string;
  size?: "sm" | "md";
}

export function CreativeCircleBadge({ userId, size = "sm" }: CreativeCircleBadgeProps) {
  const [tier, setTier] = useState<ReturnType<typeof getNetworkTier> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("invites")
        .select("current_uses")
        .eq("inviter_id", userId)
        .gt("current_uses", 0);
      
      const total = (data || []).reduce((sum, inv) => sum + (inv.current_uses || 0), 0);
      if (total > 0) {
        setTier(getNetworkTier(total));
      }
    };
    fetch();
  }, [userId]);

  if (!tier || tier.tier === "none") return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              "gap-0.5 border-0 font-semibold cursor-default",
              size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs",
              `bg-gradient-to-r ${tier.gradient}`,
              tier.color,
            )}
          >
            <span>{tier.icon}</span>
            {tier.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-semibold">{tier.icon} {tier.label} — Creative Circle</p>
          <p className="text-muted-foreground">{tier.tagline}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
