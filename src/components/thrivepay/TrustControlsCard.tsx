import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, ShieldQuestion, History, LifeBuoy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VERIFICATION_COPY: Record<string, { label: string; icon: typeof ShieldCheck; tone: string }> = {
  verified: { label: "Identity verified", icon: ShieldCheck, tone: "text-green-500" },
  pending: { label: "Verification in progress", icon: ShieldQuestion, tone: "text-amber-500" },
  unverified: { label: "Identity not verified", icon: ShieldAlert, tone: "text-muted-foreground" },
};

/**
 * Security/trust state + where audit history and support live — separate
 * from the Payouts & Fees tab's Stripe-onboarding checklist, which covers
 * bank-connection status specifically, not account-level trust.
 */
export function TrustControlsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [verification, setVerification] = useState<string>("unverified");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("verification_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setVerification(data?.verification_status || "unverified"));
  }, [user?.id]);

  const v = VERIFICATION_COPY[verification] || VERIFICATION_COPY.unverified;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <v.icon className={`h-4 w-4 ${v.tone}`} />
          <span className="text-sm font-medium">{v.label}</span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Kretopia never holds your funds directly — payouts route straight from Stripe to your
          bank. We can see that a payment happened, not your card number or full bank details.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => navigate("/payment-history")}>
            <History className="h-3.5 w-3.5" /> Full transaction history
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
            <a href="mailto:support@kretopia.com">
              <LifeBuoy className="h-3.5 w-3.5" /> Contact support
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
