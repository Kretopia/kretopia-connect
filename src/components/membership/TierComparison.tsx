import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Zap, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type AccountType } from "@/lib/subscriptionConfig";

interface Feature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
}

const CREATOR_FEATURES: Feature[] = [
  { name: "Credit Claiming", free: "Unlimited", pro: "Unlimited" },
  { name: "Portfolio / Credits Displayed", free: "5", pro: "Unlimited" },
  { name: "Website Builder", free: false, pro: true },
  { name: "Website Templates", free: false, pro: "3 Templates" },
  { name: "Daily Swipes", free: "20", pro: "Unlimited" },
  { name: "Browse Profiles", free: "10/month", pro: "Unlimited" },
  { name: "Direct Messaging", free: true, pro: true },
  { name: "Gig Applications", free: "2/month", pro: "Unlimited" },
  { name: "Active Projects", free: "1", pro: "Unlimited" },
  { name: "Invoices", free: "2/month", pro: "Unlimited" },
  { name: "Milestones", free: "1/project", pro: "Unlimited" },
  { name: "Contracts", free: "1/month", pro: "Unlimited" },
  { name: "Smart Briefs", free: "2/month", pro: "Unlimited" },
  { name: "Commission on Sales", free: "Higher", pro: "Lower" },
  { name: "Smart Match Explanations", free: false, pro: true },
  { name: "Undo Swipe", free: false, pro: "3/day" },
  { name: "Profile Verification Badge", free: false, pro: true },
  { name: "Advanced Search Filters", free: false, pro: true },
  { name: "Press Links & Awards", free: false, pro: true },
  { name: "Priority Listing", free: false, pro: true },
  { name: "Priority Support", free: false, pro: true },
];

const BRAND_FEATURES: Feature[] = [
  { name: "Company Page", free: "Basic", pro: "Branded" },
  { name: "Direct Messaging", free: true, pro: true },
  { name: "Browse Talent", free: "10/month", pro: "Unlimited" },
  { name: "Paid Job Posts", free: "Unlimited", pro: "Unlimited" },
  { name: "Barter/Collab Posts", free: "3/month", pro: "Unlimited" },
  { name: "Invoices", free: "2/month", pro: "Unlimited" },
  { name: "Active Projects", free: "1", pro: "Unlimited" },
  { name: "Milestones", free: "1/project", pro: "Unlimited" },
  { name: "Contracts", free: "1/month", pro: "Unlimited" },
  { name: "Smart Talent Matching", free: "1/month", pro: "Unlimited" },
  { name: "Smart Job Descriptions", free: "1/month", pro: "Unlimited" },
  { name: "Commission on Sales", free: "Higher", pro: "Lower" },
  { name: "Applicant Tracking", free: false, pro: true },
  { name: "Hiring Analytics", free: false, pro: true },
  { name: "Verification Badge", free: false, pro: true },
  { name: "Advanced Talent Filters", free: false, pro: true },
  { name: "Priority Listing", free: false, pro: true },
  { name: "Priority Support", free: false, pro: true },
];

interface TierComparisonProps {
  currentTier?: string;
  accountType?: AccountType;
}

export function TierComparison({ currentTier = "free", accountType = "individual" }: TierComparisonProps) {
  const navigate = useNavigate();
  const isCompany = accountType === "company";
  const features = isCompany ? BRAND_FEATURES : CREATOR_FEATURES;

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

  const tiers = isCompany
    ? [
        { key: "free", name: "Free", price: "$0", icon: <Building2 className="h-5 w-5" /> },
        { key: "brand_pro", name: "Brand Pro", price: "$49/mo", icon: <Sparkles className="h-5 w-5" />, popular: true },
      ]
    : [
        { key: "free", name: "Spark", price: "$0", icon: <Zap className="h-5 w-5" /> },
        { key: "pro", name: "Pro", price: "$29/mo", icon: <Sparkles className="h-5 w-5" />, popular: true },
      ];

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[600px]">
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
                  <Badge className="bg-primary text-xs">Recommended</Badge>
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
                {renderValue(feature.pro)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
