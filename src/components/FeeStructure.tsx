import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Zap, Crown } from "lucide-react";
import { PLATFORM_FEES, getFeeDisplayText } from "@/lib/platformFees";

interface FeeStructureProps {
  currentTier?: string | null;
}

export const FeeStructure = ({ currentTier = 'free' }: FeeStructureProps) => {
  const tiers = [
    {
      name: "Spark",
      tier: "free",
      icon: CheckCircle,
      fee: PLATFORM_FEES.free,
      color: "bg-gray-500",
      features: ["20% service fee (charged to brand)", "Talent keeps 100%", "30 swipes/day", "Standard support"],
    },
    {
      name: "Pro",
      tier: "pro",
      icon: Zap,
      fee: PLATFORM_FEES.pro,
      color: "bg-primary",
      price: "$12/mo",
      features: ["15% service fee (charged to brand)", "Talent keeps 100%", "Unlimited swipes", "All features unlocked"],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Fee Structure</CardTitle>
        <CardDescription>
          Brands pay the service fee — creators always keep 100% of their rate
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isCurrentTier = currentTier === tier.tier;
            
            return (
              <div
                key={tier.tier}
                className={`relative rounded-lg border-2 p-4 ${
                  isCurrentTier ? "border-primary" : "border-border"
                }`}
              >
                {isCurrentTier && (
                  <Badge className="absolute -top-2 -right-2">Your Plan</Badge>
                )}
                
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-10 w-10 rounded-lg ${tier.color} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{tier.name}</h3>
                    {tier.price && (
                      <p className="text-xs text-muted-foreground">{tier.price}</p>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-3xl font-bold text-primary">
                    {getFeeDisplayText(tier.tier)}
                  </div>
                  <p className="text-sm text-muted-foreground">service fee to brand</p>
                </div>

                <Separator className="my-3" />

                <ul className="space-y-2 text-sm">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">How Service Fees Work</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>Talent keeps 100%</strong> of their quoted rate — always</li>
            <li>• Service fees are charged to the brand/company on top of the talent's rate</li>
            <li>• If a Talent Manager is involved, a 10% commission is also added to the brand's total</li>
            <li>• Stripe processing (~2.9% + 30¢) applies to the total charged amount</li>
            <li>• Example: $1,000 talent rate + 20% fee = brand pays ~$1,235 total, talent gets $1,000</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
