import { useEffect, useRef, useState } from "react";
import { FeatureWrapped } from "@/components/wrapped/FeatureWrapped";
import { Shield, Zap, Award, Star, Crown, Sparkles, TrendingUp, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PerkTierCard, type PerkTierState } from "@/components/perks/PerkTierCard";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateStatusFromCredits, getAllTiers } from "@/lib/statusEngine";
import { FeatureAITutorial } from "@/components/features/FeatureAITutorial";
import { PageBackButton } from "@/components/navigation/PageBackButton";
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentTierIdx, setCurrentTierIdx] = useState(0);
  const [verifiedCredits, setVerifiedCredits] = useState(0);
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
      setVerifiedCredits(status.metrics.verifiedCredits);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const allTiers = getAllTiers();

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <div className="relative overflow-hidden -mx-4 px-4 pt-4 pb-2">
          <PageBackButton />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-quadrille" />
          <div className="relative flex flex-col items-center text-center">
            <FeatureAITutorial featureKey="perks" label="How Perks works" steps={PERKS_TUTORIAL} className="mb-4 mt-0" />
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
          </div>
        </div>

        {/* Bottom hairline — anchors the hero, same treatment as Studio Room */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <FeatureWrapped name="Perks">
        {loading ? (
          <div className="flex items-center gap-2 text-foreground/40 text-sm py-6">
            <KretopiaSpinner className="h-4 w-4" /> Checking your status…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allTiers.map((tier, idx) => {
              // Signed out there is no "current": every rung reads as locked
              // and none offers an action.
              const state: PerkTierState = !user
                ? "locked"
                : idx === currentTierIdx
                  ? "current"
                  : idx < currentTierIdx
                    ? "unlocked"
                    : idx === currentTierIdx + 1
                      ? "next"
                      : "locked";
              return (
                <PerkTierCard
                  key={tier.tier}
                  tier={tier}
                  icon={TIER_ICONS[idx]}
                  state={state}
                  verifiedCredits={verifiedCredits}
                  onAction={() => navigate("/credits")}
                />
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Partner discounts and Founding Circle rewards land here as they go live — nothing listed
          above is a placeholder.
        </p>
        </FeatureWrapped>
      </div>
    </div>
  );
}
