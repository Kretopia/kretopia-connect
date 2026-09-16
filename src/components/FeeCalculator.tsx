import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { calculateBrandTotal, getFeeDisplayText } from "@/lib/platformFees";
import { Calculator } from "lucide-react";

interface FeeCalculatorProps {
  subscriptionTier?: string | null;
}

export const FeeCalculator = ({ subscriptionTier = 'free' }: FeeCalculatorProps) => {
  const [amount, setAmount] = useState<string>("1000");
  const [hasManager, setHasManager] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const breakdown = calculateBrandTotal(numAmount, subscriptionTier, hasManager);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Fee Calculator
        </CardTitle>
        <CardDescription>
          See exactly how fees work — brands pay the service fee, talent keeps 100%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="amount">Talent Rate</Label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-muted-foreground">$</span>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="manager-toggle" className="text-sm">Talent Manager involved?</Label>
          <Switch
            id="manager-toggle"
            checked={hasManager}
            onCheckedChange={setHasManager}
          />
        </div>

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-primary">Talent Receives</span>
            <span className="font-bold text-primary">${breakdown.talentPayout.toFixed(2)}</span>
          </div>

          <Separator />

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand pays on top:</p>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Kretopia Service Fee ({getFeeDisplayText(subscriptionTier)})
            </span>
            <span className="font-medium">+${breakdown.platformFee.toFixed(2)}</span>
          </div>

          {hasManager && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Talent Manager Commission (10%)
              </span>
              <span className="font-medium">+${breakdown.managerCommission.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Stripe Processing (~2.9% + $0.30)
            </span>
            <span className="font-medium">+${breakdown.stripeFee.toFixed(2)}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between text-base">
            <span className="font-semibold">Brand Pays Total</span>
            <span className="font-bold text-primary">${breakdown.brandTotal.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          * Talent always receives their full quoted rate. Service fees and commissions are charged to the hiring brand/company. Stripe fees may vary slightly.
        </p>
      </CardContent>
    </Card>
  );
};
