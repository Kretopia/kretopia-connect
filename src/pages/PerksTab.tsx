import { useEffect, useRef, useState } from "react";
import { Check, Lock, Shield, Zap, Award, Star, Crown, Sparkles, Loader2, TrendingUp, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateStatusFromCredits, getAllTiers } from "@/lib/statusEngine";
import { FeatureAITutorial } from "@/components/features/FeatureAITutorial";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { useFitTitleOneLine } from "@/hooks/useFitTitleOneLine";

const TIER_ICONS = [Shield, Zap, Award, Star, Crown, Sparkles];

const PERKS_TUTORIAL: TutorialStep[] = [
  { icon: Shield, title: "See your real status", body: "Your tier is computed from your actual verified credits — not a number anyone can buy or fake." },
  { icon: TrendingUp, title: "Perks stack as you grow", body: "Confirm more credits, earn more co-signs, and the next tier's perks unlock automatically." },
  { icon: KeyRound, title: "Know exactly what's next", body: "Locked tiers stay visible so you always know what building your reputation actually gets you." },
];

/**
 * /perks — real ThriveStatus tier ladder and the perks each tier actually
 * unlocks (statusEngine.getAllTiers(), the same data TierBenefitsComparison
 * uses). Current tier is computed from the user's own verified credits, not
 * invented. No fabricated partner discounts or member counts — those don't
 * exist as real data yet, so they're simply not shown.
 */
export default function PerksTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentTierIdx, setCurrentTierIdx] = useState(0);
  const titleWrapperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useFitTitleOneLine(titleWrapperRef, titleRef, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("credits")
        .select("verification_status")
        .eq("user_id", user.id);
      if (cancelled) return;
      const status = calculateStatusFromCredits(data ?? []);
      setCurrentTierIdx(status.tierIndex);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const allTiers = getAllTiers();

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div className="relative overflow-hidden -mx-4 px-4 pt-4 pb-2">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-quadrille" />
          <div className="relative flex flex-col items-center text-center">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--energy))] mb-3 px-2.5 py-1 rounded-full border border-[hsl(var(--energy)/0.35)] bg-[hsl(var(--energy)/0.06)] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))] shadow-[0_0_8px_hsl(var(--energy)/0.8)]" />
              ThriveStatus
            </p>
            <div ref={titleWrapperRef} className="w-full max-w-3xl">
              <h1
                ref={titleRef}
                className="font-black tracking-[-0.03em] text-foreground leading-[1.05]"
                style={{ fontSize: "3rem" }}
              >
                Perks. <span className="pink-glow-breathe" style={{ color: "hsl(var(--energy))" }}>Earned, not bought.</span>
              </h1>
            </div>
            <p className="mt-3 text-sm sm:text-base text-foreground/60 max-w-xl mx-auto">
              What each ThriveStatus tier unlocks. Perks stack as your verified credits and
              reputation grow.
            </p>
            <FeatureAITutorial featureKey="perks" label="How Perks works" steps={PERKS_TUTORIAL} />
          </div>
        </div>

        {/* Bottom hairline — anchors the hero, same treatment as Studio Room */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {loading ? (
          <div className="flex items-center gap-2 text-foreground/40 text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your status…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allTiers.map((tier, idx) => {
              const isCurrentTier = !!user && idx === currentTierIdx;
              const isUnlocked = !!user && idx <= currentTierIdx;
              const Icon = TIER_ICONS[idx];
              return (
                <div
                  key={tier.tier}
                  className={`flex flex-col min-h-[216px] rounded-xl border p-4 ${
                    isCurrentTier ? "border-[hsl(var(--energy)/0.5)] bg-[hsl(var(--energy)/0.05)]" : "border-border bg-foreground/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <Icon className={`h-4 w-4 shrink-0 ${isUnlocked ? "text-[hsl(var(--energy))]" : "text-foreground/30"}`} aria-hidden />
                    <h3 className="text-sm font-bold truncate">{tier.label}</h3>
                    {isCurrentTier && (
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--energy))] border border-[hsl(var(--energy)/0.35)] bg-[hsl(var(--energy)/0.1)] backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                        <span className="h-1 w-1 rounded-full bg-[hsl(var(--energy))]" />
                        Your status
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mt-3">
                    {tier.perks.map((perk, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Check className={`h-3 w-3 mt-0.5 shrink-0 ${isUnlocked ? "text-[hsl(var(--energy))]" : "text-foreground/25"}`} aria-hidden />
                        <span className={`line-clamp-1 ${isUnlocked ? "text-foreground/80" : "text-foreground/35"}`}>{perk}</span>
                      </div>
                    ))}
                  </div>

                  {!isUnlocked && (
                    <div className="flex items-center gap-1.5 text-[11px] text-foreground/35 mt-auto pt-3 border-t border-border">
                      <Lock className="h-3 w-3 shrink-0" aria-hidden />
                      Build your reputation to unlock
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-foreground/35">
          Partner discounts and Founding Circle rewards land here as they go live — nothing listed
          above is a placeholder.
        </p>
      </div>
    </div>
  );
}
