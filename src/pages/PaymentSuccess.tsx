import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Sparkles, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [tier, setTier] = useState<string>("");
  const [bonusXp, setBonusXp] = useState<number | null>(null);
  const isFounder = searchParams.get("type") === "founder";

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        if (isFounder) {
          // Verify founder payment
          const sessionId = searchParams.get("session_id");
          if (sessionId) {
            console.log('[PaymentSuccess] Verifying founder payment...');
            const { data: founderData, error: founderError } = await supabase.functions.invoke(
              "verify-founder-payment",
              { body: { sessionId } }
            );
            if (founderError) {
              console.error('[PaymentSuccess] Founder verification error:', founderError);
            } else {
              console.log('[PaymentSuccess] Founder verified:', founderData);
              if (founderData?.bonus_xp) {
                setBonusXp(founderData.bonus_xp);
              }
            }
          }
        } else {
          // Regular subscription sync
          console.log('[PaymentSuccess] Syncing subscription with Stripe...');
          const { data: syncData, error: syncError } = await supabase.functions.invoke("check-subscription");
          if (syncError) {
            console.error('[PaymentSuccess] Error syncing subscription:', syncError);
          } else {
            console.log('[PaymentSuccess] Subscription synced:', syncData);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("user_id", user.id)
          .single();

        if (profile?.subscription_tier) {
          setTier(profile.subscription_tier);
          console.log('[PaymentSuccess] Updated tier:', profile.subscription_tier);
          
          const { analytics } = await import("@/lib/analytics");
          analytics.subscriptionStart(profile.subscription_tier);
        }
      } catch (error) {
        console.error("Error verifying payment:", error);
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [navigate, searchParams, isFounder]);

  if (verifying) {
    return (
      <div className="container mx-auto py-16 px-4 flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-semibold">Verifying your payment...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This will only take a moment
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFounderTier = tier === "founder";

  return (
    <div className="container mx-auto py-16 px-4 flex items-center justify-center min-h-screen">
      <Card className={`max-w-md w-full ${isFounderTier ? 'border-amber-500 border-2' : ''}`}>
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center ${
            isFounderTier 
              ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
              : 'bg-green-100 dark:bg-green-900/30'
          }`}>
            {isFounderTier 
              ? <Crown className="h-10 w-10 text-white" />
              : <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            }
          </div>
          <CardTitle className="text-2xl">
            {isFounderTier ? "Welcome to the Founder Circle! ⭕" : "Payment Successful!"}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {isFounderTier 
              ? "You're now a founding member with lifetime Pro access." 
              : "Welcome to Pro! Your subscription is now active."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">You now have access to:</p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  {isFounderTier ? (
                    <>
                      <li>• ⭕ Exclusive Founder Circle badge</li>
                      <li>• ♾Lifetime Pro access</li>
                      <li>• 5% platform fees</li>
                      <li>• 🎁 +{bonusXp || 5000} Bonus XP</li>
                      <li>• 🎟Event access perks</li>
                      <li>• All Pro features unlocked</li>
                    </>
                  ) : (
                    <>
                      <li>• Unlimited daily swipes</li>
                      <li>• Smart Match recommendations</li>
                      <li>• Undo swipe feature</li>
                      <li>• Unlimited portfolio items</li>
                      <li>• Profile verification</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/circle")} className="w-full">
              Start Matching
            </Button>
            <Button onClick={() => navigate("/profile")} variant="outline" className="w-full">
              View My Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
