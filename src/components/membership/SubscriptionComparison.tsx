import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Feature {
  name: string;
  free: boolean | string;
  creator_pro: boolean | string;
}

const features: Feature[] = [
  { name: "Daily Swipes", free: "20", creator_pro: "Unlimited" },
  { name: "Portfolio / Credits", free: "5", creator_pro: "Unlimited" },
  { name: "Website Builder", free: false, creator_pro: true },
  { name: "Website Templates", free: false, creator_pro: "All 9 Templates" },
  { name: "Custom Domain", free: false, creator_pro: true },
  { name: "Site Analytics", free: false, creator_pro: true },
  { name: "Active Projects", free: "1", creator_pro: "Unlimited" },
  { name: "Smart Briefs & Templates", free: "2/month", creator_pro: "Unlimited" },
  { name: "Undo Swipe", free: false, creator_pro: "3/day" },
  { name: "Profile Verification Badge", free: false, creator_pro: true },
  { name: "Advanced Search Filters", free: false, creator_pro: true },
  { name: "Priority Matching", free: false, creator_pro: true },
  { name: "Partner Discounts", free: "5%", creator_pro: "15%" },
  { name: "Early Access to Features", free: false, creator_pro: true },
];

interface SubscriptionComparisonProps {
  currentTier?: string;
}

export function SubscriptionComparison({ currentTier = "free" }: SubscriptionComparisonProps) {
  const navigate = useNavigate();

  const renderValue = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-5 w-5 text-green-500 mx-auto" />
      ) : (
        <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  const tiers = [
    { key: "free", name: "Spark", price: "$0", icon: <Sparkles className="h-5 w-5" /> },
    { key: "creator_pro", name: "Creator Pro", price: "$59/mo", icon: <Crown className="h-5 w-5" />, popular: true },
  ];

  return (
    <>
      {/* Mobile View - Stacked Cards */}
      <div className="block md:hidden space-y-6">
        {tiers.map((tier) => (
          <Card
            key={tier.key}
            className={`relative ${
              tier.popular ? "border-primary shadow-lg" : ""
            } ${currentTier === tier.key ? "border-green-500 shadow-xl" : ""}`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-xs">Most Popular</Badge>
              </div>
            )}
            {currentTier === tier.key && (
              <div className="absolute -top-3 right-3">
                <Badge className="bg-green-500 text-xs">Your Plan</Badge>
              </div>
            )}
            
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                {tier.icon}
                <CardTitle className="text-xl">{tier.name}</CardTitle>
              </div>
              <p className="text-center">
                <span className="text-3xl font-bold">{tier.price.split('/')[0]}</span>
                {tier.price.includes('/') && <span className="text-muted-foreground">/mo</span>}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <span className="text-sm font-medium">{feature.name}</span>
                  <div className="flex items-center">
                    {renderValue(feature[tier.key as keyof Feature] as boolean | string)}
                  </div>
                </div>
              ))}
              
              <Button
                className="w-full mt-4"
                variant={tier.popular ? "default" : "outline"}
                onClick={() => navigate("/subscription")}
                disabled={currentTier === tier.key}
              >
                {currentTier === tier.key ? "Current Plan" : tier.key === "free" ? "Free Forever" : "Upgrade Now"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block w-full overflow-x-auto pb-4">
        <div className="min-w-[800px]">
          {/* Header Row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="font-semibold text-muted-foreground">Features</div>
            {tiers.map((tier) => (
              <Card
                key={tier.key}
                className={`relative ${
                  tier.popular ? "border-primary shadow-md" : ""
                } ${currentTier === tier.key ? "border-green-500" : ""}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-xs">Most Popular</Badge>
                  </div>
                )}
                {currentTier === tier.key && (
                  <div className="absolute -top-3 right-2">
                    <Badge className="bg-green-500 text-xs">Your Plan</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {tier.icon}
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                  </div>
                  <p className="text-center text-2xl font-bold">{tier.price}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    size="sm"
                    onClick={() => navigate("/subscription")}
                    disabled={currentTier === tier.key}
                  >
                    {currentTier === tier.key ? "Current" : tier.key === "free" ? "Free" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Feature Rows */}
          <div className="space-y-1">
            {features.map((feature, index) => (
              <div
                key={index}
                className="grid grid-cols-3 gap-4 py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">{feature.name}</div>
                <div className="flex items-center justify-center">
                  {renderValue(feature.free)}
                </div>
                <div className="flex items-center justify-center">
                  {renderValue(feature.creator_pro)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
