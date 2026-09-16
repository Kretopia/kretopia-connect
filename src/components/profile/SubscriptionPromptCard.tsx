import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type SubscriptionTier } from "@/lib/subscriptionLimits";

interface SubscriptionPromptCardProps {
  currentTier: SubscriptionTier;
}

export function SubscriptionPromptCard({ currentTier }: SubscriptionPromptCardProps) {
  const navigate = useNavigate();

  // Only show for free tier users
  if (currentTier !== 'free') return null; // Pro and Founder both hide this

  const proFeatures = [
    "Your own creator website",
    "Full invoicing & milestone payments",
    "Project management workspace",
    "P&L dashboard & expense tracking",
    "EPK-to-PDF deck export",
    "Unlimited swipes & matches",
    "Profile verification badge",
    "Save 17% with annual billing",
  ];

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/5 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Go Creator — $29/mo</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your website, invoicing, milestone payments, project tools & verified badge. Try free for 7 days.
            </p>
            <ul className="space-y-2 mb-4">
              {proFeatures.map((feature, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button 
              onClick={() => navigate('/subscription')} 
              className="w-full"
              size="sm"
            >
              Upgrade to Creator
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
