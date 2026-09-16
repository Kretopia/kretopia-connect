import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Target } from "lucide-react";
import { Link } from "react-router-dom";
import type { Campaign } from "@/hooks/useThriveFund";

interface CampaignCardProps {
  campaign: Campaign;
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);

const daysLeft = (deadline: string) => {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

export const CampaignCard = ({ campaign }: CampaignCardProps) => {
  const pct = Math.min(100, Math.round((campaign.total_raised / campaign.goal_amount) * 100));
  const days = daysLeft(campaign.deadline);
  const isFunded = campaign.status === "funded" || pct >= 100;

  return (
    <Link to={`/fund/${campaign.slug}`} className="block group">
      <Card className="overflow-hidden hover:border-primary/40 transition-all hover:-translate-y-0.5">
        <div className="aspect-[16/10] bg-muted relative overflow-hidden">
          {campaign.cover_image_url ? (
            <img
              src={campaign.cover_image_url}
              alt={campaign.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Target className="h-10 w-10 text-primary/60" />
            </div>
          )}
          {isFunded && (
            <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
              Funded
            </Badge>
          )}
          {campaign.category && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
              {campaign.category}
            </Badge>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {campaign.title}
          </h3>
          {campaign.tagline && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{campaign.tagline}</p>
          )}

          <div className="mt-3">
            <Progress value={pct} className="h-1.5" />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="font-bold text-primary">{pct}%</span>
              <span className="text-muted-foreground">
                {formatCurrency(campaign.total_raised, campaign.currency)} raised
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {campaign.backer_count} backers
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {days} {days === 1 ? "day" : "days"} left
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
};
