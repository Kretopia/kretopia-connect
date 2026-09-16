import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Calculator, TrendingUp, Loader2, ArrowRight, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface AIMarkupHelperProps {
  lineItems: LineItem[];
  currency: string;
  onApplyMarkup: (updatedItems: LineItem[], markupPercentage: number) => void;
}

interface MarkupSuggestion {
  suggested_markup: number;
  reasoning: string;
  industry_range: string;
  adjusted_items: { description: string; original_rate: number; suggested_rate: number }[];
}

export function AIMarkupHelper({ lineItems, currency, onApplyMarkup }: AIMarkupHelperProps) {
  const [manualMarkup, setManualMarkup] = useState("20");
  const [aiSuggestion, setAiSuggestion] = useState<MarkupSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Manual markup calculator
  const applyManualMarkup = () => {
    const pct = parseFloat(manualMarkup) || 0;
    const updated = lineItems.map(item => ({
      ...item,
      rate: Math.round(item.rate * (1 + pct / 100) * 100) / 100,
      amount: Math.round(item.quantity * item.rate * (1 + pct / 100) * 100) / 100,
    }));
    onApplyMarkup(updated, pct);
    toast.success(`${pct}% markup applied to all line items`);
  };

  // AI markup suggestion
  const getAISuggestion = async () => {
    if (lineItems.every(i => !i.description || i.rate === 0)) {
      toast.error("Add line items with descriptions and rates first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-markup-suggest", {
        body: {
          line_items: lineItems.map(i => ({
            description: i.description,
            quantity: i.quantity,
            rate: i.rate,
          })),
          currency,
        },
      });
      if (error) throw error;
      setAiSuggestion(data);
    } catch (err) {
      console.error("AI markup error:", err);
      toast.error("Couldn't draft a suggestion. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    const pct = aiSuggestion.suggested_markup;
    const updated = lineItems.map(item => {
      const suggested = aiSuggestion.adjusted_items.find(
        a => a.description === item.description
      );
      const newRate = suggested ? suggested.suggested_rate : item.rate * (1 + pct / 100);
      return {
        ...item,
        rate: Math.round(newRate * 100) / 100,
        amount: Math.round(item.quantity * newRate * 100) / 100,
      };
    });
    onApplyMarkup(updated, pct);
    setAiSuggestion(null);
    toast.success(`AI-suggested ${pct}% markup applied`);
  };

  const presetMarkups = [
    { label: "15%", value: 15, desc: "Standard" },
    { label: "25%", value: 25, desc: "Agency" },
    { label: "50%", value: 50, desc: "Premium" },
    { label: "100%", value: 100, desc: "Rush" },
  ];

  const currentSubtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const markupAmount = currentSubtotal * (parseFloat(manualMarkup) / 100);
  const afterMarkup = currentSubtotal + markupAmount;

  const getCurrencySymbol = (c: string) => {
    const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹", NGN: "₦", TTD: "TT$", CAD: "C$", AUD: "A$" };
    return symbols[c] || `${c} `;
  };
  const sym = getCurrencySymbol(currency);

  return (
    <Card className="p-4 border-primary/20 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Markup Calculator</h4>
            <p className="text-[10px] text-muted-foreground">Auto-calculate or get smart pricing suggestions</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowCalculator(!showCalculator)}
        >
          {showCalculator ? "Hide" : "Expand"}
        </Button>
      </div>

      {showCalculator && (
        <>
          {/* Quick Presets */}
          <div className="flex gap-1.5 flex-wrap">
            {presetMarkups.map(p => (
              <button
                key={p.value}
                onClick={() => setManualMarkup(String(p.value))}
                className={`px-2.5 py-1 rounded-md text-xs transition-all border ${
                  manualMarkup === String(p.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary/50"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="text-[10px] ml-1 opacity-70">{p.desc}</span>
              </button>
            ))}
          </div>

          {/* Manual Input */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Custom Markup %</Label>
              <div className="relative">
                <Input
                  className="h-8 text-sm pr-8"
                  type="number"
                  value={manualMarkup}
                  onChange={e => setManualMarkup(e.target.value)}
                  placeholder="20"
                />
                <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={applyManualMarkup}>
              <ArrowRight className="h-3 w-3" /> Apply
            </Button>
          </div>

          {/* Live Preview */}
          <div className="text-xs space-y-1 bg-background/60 rounded-lg p-2.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Current subtotal</span>
              <span>{sym}{currentSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Markup ({manualMarkup}%)</span>
              <span className="text-green-600">+{sym}{markupAmount.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>After markup</span>
              <span>{sym}{afterMarkup.toFixed(2)}</span>
            </div>
          </div>

          {/* AI Suggestion */}
          <Separator />
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={getAISuggestion}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing rates...</>
              ) : (
                <><Sparkles className="h-3 w-3" /> Get AI Pricing Suggestion</>
              )}
            </Button>

            {aiSuggestion && (
              <Card className="p-3 bg-background space-y-2 border-primary/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">AI Recommendation</span>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                    {aiSuggestion.suggested_markup}% markup
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{aiSuggestion.reasoning}</p>
                <p className="text-[10px] text-muted-foreground">
                  Industry range: <span className="font-medium text-foreground">{aiSuggestion.industry_range}</span>
                </p>

                {aiSuggestion.adjusted_items.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {aiSuggestion.adjusted_items.map((item, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="truncate flex-1 text-muted-foreground">{item.description}</span>
                        <span className="text-muted-foreground ml-2">{sym}{item.original_rate.toFixed(2)}</span>
                        <ArrowRight className="h-3 w-3 mx-1 text-primary" />
                        <span className="font-medium text-primary">{sym}{item.suggested_rate.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={applyAISuggestion}>
                  <Sparkles className="h-3 w-3" /> Apply AI Suggestion
                </Button>
                <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                  Thrive can make mistakes — sanity-check this against your local
                  market (Bali ≠ NYC) before sending to the client.
                </p>
              </Card>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
