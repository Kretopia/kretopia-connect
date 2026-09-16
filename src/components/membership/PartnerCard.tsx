import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { awardCredits } from "@/lib/creditSystem";

interface PartnerCardProps {
  id: string;
  name: string;
  type: string;
  description?: string;
  address?: string;
  city?: string;
  discountValue?: string;
  discountType?: string;
  redemptionCode?: string;
  redemptionUrl?: string;
  logoUrl?: string;
  imageUrl?: string;
  pointsPerVisit?: number;
  tierRequired?: string;
  userTier: string;
  onCheckIn?: () => void;
}

export const PartnerCard = ({
  id,
  name,
  type,
  description,
  address,
  city,
  discountValue,
  discountType,
  redemptionCode,
  redemptionUrl,
  logoUrl,
  imageUrl,
  pointsPerVisit,
  tierRequired,
  userTier,
  onCheckIn,
}: PartnerCardProps) => {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const copyCode = async () => {
    if (redemptionCode) {
      await navigator.clipboard.writeText(redemptionCode);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCheckIn = async () => {
    if (!onCheckIn) return;
    
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await awardCredits(
        user.id,
        pointsPerVisit || 10,
        "partner_visit",
        `Visited ${name}`
      );

      toast.success(`+${pointsPerVisit || 10} points earned!`);
      onCheckIn();
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Failed to check in");
    } finally {
      setChecking(false);
    }
  };

  const canAccess = tierRequired === "free" || 
    (tierRequired === "creator_pro" && userTier === "creator_pro");

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card/50 backdrop-blur-sm">
      {(imageUrl || logoUrl) && (
        <div className="h-48 bg-gradient-to-br from-muted via-muted/80 to-muted/60 relative overflow-hidden">
          <img
            src={imageUrl || logoUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {!canAccess && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/40 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <Badge variant="secondary" className="text-base px-4 py-2 bg-background/90 backdrop-blur-sm">
                  Creator+ Required
                </Badge>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{name}</h3>
            <Badge variant="secondary" className="capitalize text-xs font-medium">
              {type}
            </Badge>
            {address && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-3">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="line-clamp-1">{address}{city && `, ${city}`}</span>
              </div>
            )}
          </div>
        </div>

        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {discountValue && canAccess && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-primary text-primary-foreground font-bold text-lg px-3 py-1">
                  {discountValue}{discountType === "percentage" ? "%" : ""} OFF
                </Badge>
              </div>
              {redemptionCode && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-background/80 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-border/50">
                    <code className="text-sm font-mono font-semibold tracking-wide">
                      {redemptionCode}
                    </code>
                  </div>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    onClick={copyCode}
                    className="h-10 w-10 flex-shrink-0"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
            <div className="absolute -right-6 -bottom-6 text-6xl opacity-5"></div>
          </div>
        )}

        <div className="pt-2">
          {canAccess ? (
            <div className="flex gap-2">
              {redemptionUrl && (
                <Button 
                  variant="default" 
                  className="flex-1 group/btn" 
                  asChild
                >
                  <a href={redemptionUrl} target="_blank" rel="noopener noreferrer">
                    Redeem Offer
                    <ExternalLink className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </a>
                </Button>
              )}
              {pointsPerVisit && (
                <Button 
                  onClick={handleCheckIn} 
                  disabled={checking}
                  variant="outline"
                  className="flex-1"
                >
                  {checking ? "Checking in..." : `Check In (+${pointsPerVisit} pts)`}
                </Button>
              )}
            </div>
          ) : (
            <Button className="w-full group/btn bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity" asChild>
              <a href="/subscription">
                Upgrade to Access
                <ExternalLink className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
