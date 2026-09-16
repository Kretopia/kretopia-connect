import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { trackLandingCtaClick } from "@/lib/landingMetrics";

/**
 * Sticky "Get Started" CTA bar for mobile users, guest-only.
 * Appears after scrolling past the hero section.
 *
 * Sits at the true bottom of the viewport (not offset above a bottom nav
 * bar) -- App.tsx's KretopiaBottomNav/QuickActionFab/KretoLauncher/ThriveBar
 * are all gated behind `!!user`, so a guest never sees any of them; this is
 * the only fixed bottom element they get.
 */
export const StickyMobileCTA = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (user) return;
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [user]);

  if (user || !visible) return null;

  const handleClick = () => {
    trackLandingCtaClick({
      ctaId: "sticky_mobile_get_started",
      section: "sticky_mobile",
      label: "Get Started — Free",
      destinationType: "auth",
    });
    navigate("/auth?tab=signup&src=sticky_mobile");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-1">
      <button
        onClick={handleClick}
        className="btn-glass btn-glass-primary w-full flex items-center justify-center gap-2 rounded-2xl text-energy-foreground py-3.5 text-sm font-black uppercase tracking-wider"
      >
        Get Started — Free <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
