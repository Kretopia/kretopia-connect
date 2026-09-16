import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Shield, Zap, Award, Star, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type StatusTier } from "@/lib/statusEngine";

const TIER_COLORS: Record<string, string> = {
  hobbyist: "from-muted-foreground to-muted-foreground/80",
  freelancer: "from-slate-400 to-slate-500",
  thriver: "from-primary to-primary/80",
  professional: "from-accent to-accent/80",
  celebrity: "from-foreground/80 to-foreground",
  icon: "from-primary to-accent",
};

interface DigitalMembershipCardProps {
  membershipNumber: string;
  fullName: string;
  tier: string;
  avatarUrl?: string;
  points?: number;
  onShowQR?: () => void;
}

export const DigitalMembershipCard = ({
  membershipNumber,
  fullName,
  tier,
  avatarUrl,
  points = 0,
  onShowQR,
}: DigitalMembershipCardProps) => {
  const tierKey = (tier || "hobbyist").toLowerCase();
  const colorGradient = TIER_COLORS[tierKey] || TIER_COLORS.hobbyist;
  const tierLabel = tierKey.charAt(0).toUpperCase() + tierKey.slice(1);

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${colorGradient} p-6 text-white shadow-xl`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {tierLabel}
              </Badge>
            </div>
            <h3 className="text-2xl font-bold">{fullName}</h3>
            <p className="text-white/80 text-sm mt-1">Member #{membershipNumber}</p>
          </div>
          {avatarUrl && (
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30">
              <img 
                src={avatarUrl} 
                alt={fullName} 
                className="w-full h-full object-cover" 
                loading="lazy"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-xs mb-1">Kretopia Network</p>
            <p className="text-sm font-semibold">Global Access</p>
          </div>
          {tier !== "free" && onShowQR && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onShowQR}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <QrCode className="h-4 w-4 mr-2" />
              Show QR
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
