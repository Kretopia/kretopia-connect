import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { InvoiceChaseDrawer } from "./InvoiceChaseDrawer";

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  brandName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
}

interface Insight {
  summary: string | null;
  anomaly: string | null;
  nextAction: string | null;
  overdueInvoices: OverdueInvoice[];
  generatedAt: string;
}

/**
 * The only genuinely AI-generated (LLM-backed) surface on KrePay — everything
 * else on this page (MoneyBrief, WeeklyMoneyInsights) is computed locally
 * from the user's own rows with no model call. This one calls
 * krepay-ai-insights, which sends only an aggregate of the user's own
 * numbers to the model — never raw line items or other users' data — and
 * returns plain-language text for display only. It never sends anything,
 * changes any record, or takes any action by itself; the one actionable
 * surface it offers (drafting a payment reminder) always stops at a draft
 * the user must review and explicitly confirm before it sends.
 */
export function KrePayAIInsights() {
  const { user } = useAuth();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chaseInvoiceId, setChaseInvoiceId] = useState<string | null>(null);
  const [chaseLabel, setChaseLabel] = useState<string | undefined>();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("krepay-ai-insights", { body: {} });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setInsight(data);
    } catch (e: any) {
      setError(e.message || "Couldn't load insights right now");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  return (
    <>
      <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Kreto's take</h3>
          <Badge variant="secondary" className="text-[10px] h-5">AI-generated</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={load}
            disabled={loading}
            aria-label="Refresh insight"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading && !insight && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking about your numbers…
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-muted-foreground">
            {error} — <button onClick={load} className="underline text-white hover:text-[hsl(var(--energy))] transition-colors">retry</button>
          </p>
        )}

        {insight && (
          <div className="space-y-2.5">
            {insight.summary && <p className="text-sm text-foreground">{insight.summary}</p>}

            {insight.anomaly && (
              <div className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{insight.anomaly}</span>
              </div>
            )}

            {insight.nextAction && (
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
                <span>{insight.nextAction}</span>
              </div>
            )}

            {insight.overdueInvoices?.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-2">
                {insight.overdueInvoices.map((inv) => (
                  <Button
                    key={inv.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => {
                      setChaseLabel(inv.brandName || inv.invoiceNumber);
                      setChaseInvoiceId(inv.id);
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Draft reminder — {inv.brandName || inv.invoiceNumber}
                  </Button>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground pt-1">
              Based on your current account data · generated{" "}
              {new Date(insight.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}
      </Card>

      <InvoiceChaseDrawer
        invoiceId={chaseInvoiceId}
        invoiceLabel={chaseLabel}
        onOpenChange={(open) => !open && setChaseInvoiceId(null)}
      />
    </>
  );
}
