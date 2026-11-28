import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getTierDisplayName, type SubscriptionTier } from "@/lib/subscriptionConfig";
import { billingNotice, canManageBilling } from "@/lib/billingStatus";
import { toast } from "sonner";

const STATUS_WORDS: Record<string, string> = {
  active: "Active",
  trialing: "Free trial",
  past_due: "Payment failed",
  paused: "Paused",
  canceled: "Ended",
  none: "No paid plan",
};

/**
 * The member's own Kretopia subscription, said plainly: plan, status as the provider last confirmed it, the end of the current period
 * and a way into billing (card, invoices, receipts, cancel). It is not a creator-money surface: nothing here is a balance or a payout.
 */
export function SubscriptionBillingCard() {
  const { user } = useAuth();
  const [opening, setOpening] = useState(false);
  const query = useQuery({
    queryKey: ["krepay-subscription-billing", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_status, subscription_end_date")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!user) return null;

  const openBilling = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank", "noopener");
      else throw new Error("No billing link returned");
    } catch {
      toast.error("Couldn't open billing", { description: "Try again in a moment. If you have never subscribed there is nothing to manage yet." });
    } finally {
      setOpening(false);
    }
  };

  const status = query.data?.subscription_status ?? "none";
  const tier = (query.data?.subscription_tier ?? "free") as SubscriptionTier;
  const notice = billingNotice(status);
  const end = query.data?.subscription_end_date ? new Date(query.data.subscription_end_date) : null;
  const endLabel = end && !Number.isNaN(end.getTime()) ? end.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <Card aria-labelledby="krepay-subscription-title">
      <CardHeader className="pb-2">
        <CardTitle id="krepay-subscription-title" className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" aria-hidden="true" /> Subscription & billing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.isLoading ? (
          <KretopiaSpinner className="h-5 w-5" />
        ) : query.isError ? (
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <p>Couldn't load your subscription right now.</p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Plan</dt><dd className="font-semibold">{getTierDisplayName(tier)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="font-semibold">{STATUS_WORDS[status] ?? "Unknown"}</dd></div>
              {endLabel && canManageBilling(status) && (
                <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-muted-foreground">Current period ends</dt><dd className="font-semibold">{endLabel}</dd></div>
              )}
            </dl>
            {notice && (
              <div role={notice.tone === "warn" ? "alert" : "status"} className={notice.tone === "warn" ? "rounded-lg border border-destructive/50 bg-destructive/10 p-3" : "rounded-lg border border-border bg-muted/40 p-3"}>
                <p className="font-semibold">{notice.title}</p>
                <p className="mt-1 text-muted-foreground">{notice.body}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {canManageBilling(status) ? (
                <Button size="sm" variant={status === "past_due" ? "default" : "outline"} onClick={openBilling} disabled={opening}>
                  {opening ? <KretopiaSpinner className="h-4 w-4" /> : status === "past_due" ? "Update payment method" : "Manage billing"}
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild><a href="/subscription">See plans</a></Button>
              )}
              <p className="text-xs text-muted-foreground">Invoices and receipts for your subscription are in Manage billing. This is separate from your wallet and payouts.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
